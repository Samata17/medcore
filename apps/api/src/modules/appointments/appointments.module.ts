import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { canTransition, hasSlotConflict } from "@medcore/types";
import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../../common/decorators";
import { todayRange } from "../../common/names";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";

/* ---------------- shape shared with the frontend (AppointmentRow) ---------------- */

export const appointmentInclude = {
  patient: { select: { firstName: true, lastName: true, mrn: true, userId: true } },
  doctor: { select: { userId: true, user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
} satisfies Prisma.AppointmentInclude;
type ApptWith = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export const toAppointmentRow = (a: ApptWith) => ({
  id: a.id,
  patientId: a.patientId,
  patientName: `${a.patient.firstName} ${a.patient.lastName}`,
  patientMrn: a.patient.mrn,
  doctorId: a.doctorId,
  doctorName: `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`,
  department: a.doctor.department.name,
  startsAt: a.startsAt.toISOString(),
  endsAt: a.endsAt.toISOString(),
  status: a.status,
  reason: a.reason,
  emergency: a.emergency,
  checkedInAt: a.checkedInAt?.toISOString(),
});

/* ---------------- DTOs ---------------- */

class AppointmentQuery {
  @IsOptional() @IsIn(["today"]) date?: "today";
  @IsOptional() @IsIn(["me"]) doctorId?: "me";
  @IsOptional() @IsIn(["tomorrow"]) from?: "tomorrow";
}

class BookDto {
  /** Ignored for patients (they always book for themselves). */
  @IsUUID() patientId: string;
  @IsUUID() doctorId: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value)) @IsString() @Length(3, 300) reason: string;
  @IsOptional() @IsBoolean() emergency = false;
}

class StatusDto {
  @IsEnum(AppointmentStatus) status: AppointmentStatus;
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

@ApiTags("Appointments")
@ApiBearerAuth()
@Controller()
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  /** Hospital appointments. `doctorId=me` limits to the signed-in doctor; `date=today` / `from=tomorrow` filter by day. */
  @Get("appointments")
  @RequirePermissions(P.APPOINTMENTS_READ)
  async list(@CurrentUser() user: RequestUser, @Query() q: AppointmentQuery) {
    const where: Prisma.AppointmentWhereInput = { hospitalId: hospitalOf(user) };
    if (q.doctorId === "me" || user.role === "DOCTOR") {
      if (!user.doctorId) throw new ForbiddenException("Only doctors can view their own schedule");
      where.doctorId = user.doctorId; // doctors only ever see their own list
    }
    const { from, to } = todayRange();
    if (q.date === "today") where.startsAt = { gte: from, lt: to };
    else if (q.from === "tomorrow") where.startsAt = { gte: to };
    const rows = await this.prisma.appointment.findMany({ where, include: appointmentInclude, orderBy: { startsAt: "asc" }, take: 500 });
    return rows.map(toAppointmentRow);
  }

  /** The signed-in patient's own appointments. */
  @Get("me/appointments")
  @RequirePermissions(P.SELF_PORTAL)
  async mine(@CurrentUser() user: RequestUser) {
    if (!user.patientId) return [];
    const rows = await this.prisma.appointment.findMany({ where: { patientId: user.patientId }, include: appointmentInclude, orderBy: { startsAt: "desc" } });
    return rows.map(toAppointmentRow);
  }

  @Post("appointments")
  @RequireAnyPermission(P.APPOINTMENTS_WRITE, P.SELF_PORTAL)
  async book(@CurrentUser() user: RequestUser, @Body() dto: BookDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const isPatient = user.role === "PATIENT";
    const patientId = isPatient ? user.patientId : dto.patientId;
    if (!patientId) throw new ForbiddenException("No patient record is linked to this account");
    if (isPatient && dto.emergency) throw new ForbiddenException("Emergency bookings are made by hospital staff");

    const [patient, doctor] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true, firstName: true, lastName: true, userId: true } }),
      this.prisma.doctor.findFirst({ where: { id: dto.doctorId, hospitalId }, include: { availability: true, user: { select: { firstName: true, lastName: true } } } }),
    ]);
    if (!patient) throw new NotFoundException("Patient not found");
    if (!doctor) throw new NotFoundException("Doctor not found");
    if (!doctor.isAvailable && !dto.emergency) throw new BadRequestException("This doctor isn't accepting bookings right now");

    const start = new Date(dto.startsAt);
    const end = new Date(dto.endsAt);
    if (end <= start) throw new BadRequestException("The appointment must end after it starts");
    if (start.getTime() < Date.now() - 5 * 60_000) throw new BadRequestException("You can't book a time in the past");

    // Must fit one of the doctor's configured slots that day (emergencies can be squeezed in).
    if (!dto.emergency) {
      const startMin = start.getHours() * 60 + start.getMinutes();
      const fits = doctor.availability.some(
        (w) =>
          w.weekday === start.getDay() &&
          startMin >= minutesOf(w.startTime) &&
          startMin + w.slotMinutes <= minutesOf(w.endTime) &&
          (startMin - minutesOf(w.startTime)) % w.slotMinutes === 0 &&
          end.getTime() - start.getTime() === w.slotMinutes * 60_000,
      );
      if (!fits) throw new BadRequestException("That time isn't one of the doctor's available slots");
    }

    // Serialize bookings per doctor so two people can't take the same slot at once.
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${doctor.id}))`;
      const window = { gte: new Date(start.getTime() - 4 * 3_600_000), lte: new Date(end.getTime() + 4 * 3_600_000) };
      const nearby = await tx.appointment.findMany({
        where: { OR: [{ doctorId: doctor.id }, { patientId: patient.id }], startsAt: window },
        select: { id: true, doctorId: true, patientId: true, startsAt: true, endsAt: true, status: true },
      });
      const iso = nearby.map((a) => ({ ...a, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString() }));
      if (hasSlotConflict(iso, doctor.id, dto.startsAt, dto.endsAt)) throw new ConflictException("That slot was just booked. Please choose another time.");
      // The same patient can't be in two appointments at once either.
      const patientRows = iso.filter((a) => a.patientId === patient.id).map((a) => ({ ...a, doctorId: "patient" }));
      if (hasSlotConflict(patientRows, "patient", dto.startsAt, dto.endsAt)) throw new ConflictException("This patient already has an appointment at that time.");

      return tx.appointment.create({
        data: {
          hospitalId,
          patientId: patient.id,
          doctorId: doctor.id,
          startsAt: start,
          endsAt: end,
          reason: dto.reason,
          emergency: dto.emergency,
          status: dto.emergency ? "CONFIRMED" : "PENDING",
          createdById: user.id,
        },
        include: appointmentInclude,
      });
    });

    const time = start.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    if (dto.emergency) {
      await this.notify.toUsers([doctor.userId], hospitalId, {
        type: "EMERGENCY_APPOINTMENT",
        title: "Emergency appointment",
        body: `${patient.firstName} ${patient.lastName} added to your queue at ${time}: ${dto.reason}`,
        href: `/dashboard/doctor/patients/${patient.id}`,
      });
      await this.notify.toRoles(hospitalId, ["RECEPTIONIST"], { type: "EMERGENCY_APPOINTMENT", title: "Emergency arrival", body: `${patient.firstName} ${patient.lastName} → Dr. ${doctor.user.lastName}` });
    } else if (isPatient) {
      await this.notify.toRoles(hospitalId, ["RECEPTIONIST"], {
        type: "APPOINTMENT_CONFIRMED",
        title: "New online booking",
        body: `${patient.firstName} ${patient.lastName} requested Dr. ${doctor.user.lastName} at ${time}. Please confirm.`,
        href: "/dashboard/reception",
      });
    }
    await this.audit.log({ action: "APPOINTMENT_CREATE", entity: `Appointment ${dto.emergency ? "(emergency) " : ""}${time}`, entityId: created.id, actor: user, req });
    return toAppointmentRow(created);
  }

  @Patch("appointments/:id/status")
  @RequireAnyPermission(P.APPOINTMENTS_WRITE, P.SELF_PORTAL)
  async setStatus(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: StatusDto, @Req() req: Request) {
    const a = await this.prisma.appointment.findFirst({ where: { id, hospitalId: hospitalOf(user) }, include: appointmentInclude });
    if (!a) throw new NotFoundException("Appointment not found");

    // Who may make which change:
    const allowed: Record<string, AppointmentStatus[]> = {
      PATIENT: ["CANCELLED"],
      DOCTOR: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      RECEPTIONIST: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
    };
    if (user.role === "PATIENT" && a.patientId !== user.patientId) throw new NotFoundException("Appointment not found");
    if (user.role === "DOCTOR" && a.doctorId !== user.doctorId) throw new ForbiddenException("This appointment belongs to another doctor");
    if (!(allowed[user.role] ?? []).includes(dto.status)) throw new ForbiddenException("You can't set this status");
    if (!canTransition(a.status, dto.status)) throw new BadRequestException(`Can't change status from ${a.status} to ${dto.status}`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id },
        data: { status: dto.status, ...(dto.status === "IN_PROGRESS" && !a.checkedInAt ? { checkedInAt: new Date() } : {}) },
        include: appointmentInclude,
      });
      // Starting a consultation opens the encounter's medical record.
      if (dto.status === "IN_PROGRESS") {
        await tx.medicalRecord.upsert({
          where: { appointmentId: id },
          create: { hospitalId: a.hospitalId, patientId: a.patientId, appointmentId: id, openedById: user.id },
          update: {},
        });
      }
      return row;
    });

    if (dto.status === "CONFIRMED") {
      await this.notify.toUsers([a.patient.userId], a.hospitalId, {
        type: "APPOINTMENT_CONFIRMED",
        title: "Appointment confirmed",
        body: `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}, ${a.startsAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
        href: "/dashboard/patient/appointments",
      });
    }
    if (dto.status === "CANCELLED" && user.role === "PATIENT") {
      await this.notify.toUsers([a.doctor.userId], a.hospitalId, { type: "SYSTEM", title: "Appointment cancelled", body: `${a.patient.firstName} ${a.patient.lastName} cancelled their appointment.` });
    }
    await this.audit.log({ action: `APPOINTMENT_${dto.status}`, entity: `Appointment of ${a.patient.mrn}`, entityId: id, actor: user, req });
    return toAppointmentRow(updated);
  }

  @Post("appointments/:id/check-in")
  @HttpCode(200)
  @RequirePermissions(P.APPOINTMENTS_WRITE)
  async checkIn(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    if (user.role !== "RECEPTIONIST") throw new ForbiddenException("Check-in is done at the front desk");
    const a = await this.prisma.appointment.findFirst({ where: { id, hospitalId: hospitalOf(user) } });
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.status !== "CONFIRMED") throw new BadRequestException("Only confirmed appointments can be checked in");
    if (a.checkedInAt) throw new BadRequestException("Already checked in");
    const row = await this.prisma.appointment.update({ where: { id }, data: { checkedInAt: new Date() }, include: appointmentInclude });
    await this.audit.log({ action: "APPOINTMENT_CHECK_IN", entity: `Appointment of ${row.patient.mrn}`, entityId: id, actor: user, req });
    return toAppointmentRow(row);
  }
}

@Module({ controllers: [AppointmentsController] })
export class AppointmentsModule {}

import { Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

class CreateDepartmentDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value)) @IsString() @Length(2, 60) name: string;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Departments and doctors of the user's own hospital. */
@ApiTags("Departments & doctors")
@ApiBearerAuth()
@Controller()
export class DirectoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("departments")
  @RequirePermissions(P.DIRECTORY_READ)
  async departments(@CurrentUser() user: RequestUser) {
    const hospitalId = hospitalOf(user);
    const from = startOfToday();
    const to = new Date(from.getTime() + 86_400_000);
    const deps = await this.prisma.department.findMany({
      where: { hospitalId },
      orderBy: { name: "asc" },
      include: { doctors: { select: { id: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { experienceYears: "desc" } } },
    });
    const todays = await this.prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { hospitalId, startsAt: { gte: from, lt: to }, status: { notIn: ["CANCELLED"] } },
      _count: true,
    });
    const perDoctor = new Map(todays.map((t) => [t.doctorId, t._count]));
    return deps.map((d) => ({
      id: d.id,
      name: d.name,
      headDoctor: d.doctors[0] ? `Dr. ${d.doctors[0].user.firstName} ${d.doctors[0].user.lastName}` : undefined,
      doctors: d.doctors.length,
      patientsToday: d.doctors.reduce((s, doc) => s + (perDoctor.get(doc.id) ?? 0), 0),
    }));
  }

  @Post("departments")
  @RequirePermissions(P.HOSPITAL_MANAGE)
  async createDepartment(@CurrentUser() user: RequestUser, @Body() dto: CreateDepartmentDto, @Req() req: Request) {
    const d = await this.prisma.department.create({ data: { hospitalId: hospitalOf(user), name: dto.name } });
    await this.audit.log({ action: "DEPARTMENT_CREATE", entity: d.name, entityId: d.id, actor: user, req });
    return { id: d.id, name: d.name, doctors: 0, patientsToday: 0 };
  }

  @Get("doctors")
  @RequirePermissions(P.DIRECTORY_READ)
  async doctors(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.doctor.findMany({
      where: { hospitalId: hospitalOf(user), user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
      orderBy: [{ department: { name: "asc" } }, { user: { lastName: "asc" } }],
    });
    return rows.map((d) => ({
      id: d.id,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
      specialization: d.specialization,
      departmentId: d.departmentId,
      department: d.department.name,
      experienceYears: d.experienceYears,
      consultationFee: Number(d.consultationFee),
      available: d.isAvailable,
    }));
  }

  private async doctorInHospital(user: RequestUser, id: string) {
    const doc = await this.prisma.doctor.findFirst({ where: { id, hospitalId: hospitalOf(user) }, include: { availability: true } });
    if (!doc) throw new NotFoundException("Doctor not found");
    return doc;
  }

  /** Weekly working hours, in the shape the booking screen uses. */
  @Get("doctors/:id/availability")
  @RequirePermissions(P.DIRECTORY_READ)
  async availability(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    const doc = await this.doctorInHospital(user, id);
    const weekdays = [...new Set(doc.availability.map((a) => a.weekday))].sort();
    // Windows are assumed identical across working days (as configured in the seed/admin UI).
    const first = weekdays[0];
    const windows = doc.availability
      .filter((a) => a.weekday === first)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((a) => ({ start: a.startTime, end: a.endTime }));
    return { weekdays, windows, slotMinutes: doc.availability[0]?.slotMinutes ?? 15 };
  }

  /**
   * Occupied slots for the next 30 days. Only times and status are returned —
   * never patient details — so patients can use it to pick a free slot.
   */
  @Get("doctors/:id/appointments")
  @RequirePermissions(P.DIRECTORY_READ)
  async occupied(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.doctorInHospital(user, id);
    const from = startOfToday();
    const rows = await this.prisma.appointment.findMany({
      where: { doctorId: id, startsAt: { gte: from, lt: new Date(from.getTime() + 30 * 86_400_000) }, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] } },
      select: { id: true, doctorId: true, startsAt: true, endsAt: true, status: true },
    });
    return rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));
  }
}

@Module({ controllers: [DirectoryController] })
export class DirectoryModule {}

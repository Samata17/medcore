import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DiagnosisType, type Prisma } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { todayRange, userNames } from "../../common/names";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { appointmentInclude, toAppointmentRow } from "../appointments/appointments.module";
import { AuditService } from "../audit/audit.service";
import { toPatientRow } from "../patients/patients.controller";
import { labOrderInclude, prescriptionInclude, toLabOrderRow, toPrescriptionRow } from "../shared/mappers";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class VitalsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(260) systolic?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(30) @Max(160) diastolic?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(250) pulse?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(30) @Max(45) temperatureC?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(100) spo2?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(30) @Max(250) heightCm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(350) weightKg?: number;
}

class DiagnosisDto {
  @IsOptional() @Matches(/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/, { message: "Use ICD-10 format, e.g. I10 or E11.9" }) code?: string;
  @Transform(trim) @IsString() @Length(3, 200) description: string;
  @IsEnum(DiagnosisType) type: DiagnosisType;
}

class NoteDto {
  @Transform(trim) @IsString() @Length(3, 2000) symptoms: string;
  @Transform(trim) @IsString() @Length(3, 2000) treatmentPlan: string;
  @IsOptional() @IsUUID() amendsId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) amendReason?: string;
}

/** BMI = kg / m², one decimal. */
const bmiOf = (w?: number, h?: number) => (w && h ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null);

@ApiTags("Medical records")
@ApiBearerAuth()
@Controller()
export class RecordsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Full record. `patientView` hides lab orders that aren't approved yet. */
  private async build(patientId: string, hospitalId: string, patientView: boolean) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
      include: {
        allergies: { select: { substance: true } },
        appointments: { where: { status: "COMPLETED" }, orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } },
        vaccinations: { orderBy: { givenOn: "desc" } },
        familyHistory: true,
      },
    });
    if (!patient) throw new NotFoundException("Patient not found");

    const [records, prescriptions, labOrders, appointments] = await Promise.all([
      this.prisma.medicalRecord.findMany({ where: { patientId }, include: { vitals: true, diagnoses: true, notes: true } }),
      this.prisma.prescription.findMany({ where: { patientId }, include: prescriptionInclude, orderBy: { issuedAt: "desc" } }),
      this.prisma.labOrder.findMany({ where: { patientId, ...(patientView ? { status: "APPROVED" } : {}) }, include: labOrderInclude, orderBy: { orderedAt: "desc" } }),
      this.prisma.appointment.findMany({ where: { patientId }, include: appointmentInclude, orderBy: { startsAt: "desc" } }),
    ]);

    const vitals = records.flatMap((r) => r.vitals);
    const diagnoses = records.flatMap((r) => r.diagnoses);
    const notes = records.flatMap((r) => r.notes);
    const names = await userNames(this.prisma, [
      ...vitals.map((v) => v.recordedById),
      ...diagnoses.map((d) => d.recordedById),
      ...notes.map((n) => n.authorId),
      ...labOrders.map((o) => o.approvedById),
    ]);
    const desc = <T,>(rows: T[], at: (r: T) => Date) => [...rows].sort((a, b) => at(b).getTime() - at(a).getTime());
    const num = (d: unknown) => (d === null || d === undefined ? undefined : Number(d));

    return {
      patient: toPatientRow(patient),
      vitals: desc(vitals, (v) => v.recordedAt).map((v) => ({
        id: v.id,
        recordedAt: v.recordedAt.toISOString(),
        recordedBy: names.get(v.recordedById) ?? "Unknown",
        systolic: v.systolic ?? undefined,
        diastolic: v.diastolic ?? undefined,
        pulse: v.pulse ?? undefined,
        temperatureC: num(v.temperatureC),
        spo2: v.spo2 ?? undefined,
        heightCm: num(v.heightCm),
        weightKg: num(v.weightKg),
        bmi: num(v.bmi),
      })),
      diagnoses: desc(diagnoses, (d) => d.recordedAt).map((d) => ({
        id: d.id,
        code: d.code ?? undefined,
        description: d.description,
        type: d.type,
        recordedAt: d.recordedAt.toISOString(),
        recordedBy: names.get(d.recordedById) ?? "Unknown",
      })),
      notes: desc(notes, (n) => n.createdAt).map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        author: names.get(n.authorId) ?? "Unknown",
        symptoms: n.symptoms,
        treatmentPlan: n.treatmentPlan,
        amendsId: n.amendsId ?? undefined,
        amendReason: n.amendReason ?? undefined,
      })),
      prescriptions: prescriptions.map(toPrescriptionRow),
      labOrders: labOrders.map((o) => toLabOrderRow(o, names)),
      appointments: appointments.map(toAppointmentRow),
      vaccinations: patient.vaccinations.map((v) => ({ name: v.vaccine, dose: v.dose, date: v.givenOn.toISOString() })),
      familyHistory: patient.familyHistory.map((f) => `${f.relation}: ${f.condition}`),
    };
  }

  @Get("patients/:id/record")
  @RequirePermissions(P.RECORDS_READ)
  async record(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const rec = await this.build(id, hospitalOf(user), false);
    await this.audit.log({ action: "MEDICAL_RECORD_VIEW", entity: `Patient ${rec.patient.mrn}`, entityId: id, actor: user, req });
    return rec;
  }

  @Get("me/record")
  @RequirePermissions(P.SELF_PORTAL)
  async myRecord(@CurrentUser() user: RequestUser) {
    if (!user.patientId) throw new NotFoundException("No patient record is linked to this account");
    return this.build(user.patientId, hospitalOf(user), true);
  }

  /**
   * The encounter to attach today's clinical entries to: the record of today's
   * active appointment, else any record opened today, else a new one.
   */
  private async currentRecordId(tx: Prisma.TransactionClient, patientId: string, hospitalId: string, userId: string) {
    const { from, to } = todayRange();
    const active = await tx.appointment.findFirst({
      where: { patientId, startsAt: { gte: from, lt: to }, status: { in: ["IN_PROGRESS", "CONFIRMED", "COMPLETED"] } },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      select: { id: true, record: { select: { id: true } } },
    });
    if (active?.record) return active.record.id;
    const today = await tx.medicalRecord.findFirst({ where: { patientId, createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "desc" } });
    if (today) return today.id;
    const created = await tx.medicalRecord.create({ data: { hospitalId, patientId, appointmentId: active?.id, openedById: userId } });
    return created.id;
  }

  private async assertPatient(user: RequestUser, patientId: string) {
    const p = await this.prisma.patient.findFirst({ where: { id: patientId, hospitalId: hospitalOf(user) }, select: { id: true, mrn: true } });
    if (!p) throw new NotFoundException("Patient not found");
    return p;
  }

  @Post("patients/:id/vitals")
  @RequirePermissions(P.VITALS_WRITE)
  async vitals(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: VitalsDto, @Req() req: Request) {
    const p = await this.assertPatient(user, id);
    if (Object.values(dto).every((v) => v === undefined)) throw new BadRequestException("Enter at least one measurement");
    if ((dto.systolic === undefined) !== (dto.diastolic === undefined)) throw new BadRequestException("Enter both systolic and diastolic values");
    if (dto.systolic !== undefined && dto.diastolic !== undefined && dto.diastolic >= dto.systolic) throw new BadRequestException("Diastolic must be lower than systolic");

    const bmi = bmiOf(dto.weightKg, dto.heightCm);
    const v = await this.prisma.$transaction(async (tx) => {
      const recordId = await this.currentRecordId(tx, id, hospitalOf(user), user.id);
      return tx.vital.create({ data: { ...dto, bmi, recordId, recordedById: user.id } });
    });
    await this.audit.log({ action: "VITALS_RECORD", entity: `Patient ${p.mrn}`, entityId: v.id, actor: user, req });
    return { id: v.id, recordedAt: v.recordedAt.toISOString(), recordedBy: `${user.firstName} ${user.lastName}`, ...dto, bmi: bmi ?? undefined };
  }

  @Post("patients/:id/diagnoses")
  @RequirePermissions(P.RECORDS_WRITE)
  async diagnosis(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: DiagnosisDto, @Req() req: Request) {
    const p = await this.assertPatient(user, id);
    const d = await this.prisma.$transaction(async (tx) => {
      const recordId = await this.currentRecordId(tx, id, hospitalOf(user), user.id);
      return tx.diagnosis.create({ data: { recordId, code: dto.code, description: dto.description, type: dto.type, recordedById: user.id } });
    });
    await this.audit.log({ action: "DIAGNOSIS_ADD", entity: `Patient ${p.mrn}: ${dto.code ?? dto.description}`, entityId: d.id, actor: user, req });
    return { id: d.id, code: d.code ?? undefined, description: d.description, type: d.type, recordedAt: d.recordedAt.toISOString(), recordedBy: `Dr. ${user.firstName} ${user.lastName}` };
  }

  /** New note, or a correction that points to (never overwrites) an earlier note. */
  @Post("patients/:id/notes")
  @RequirePermissions(P.RECORDS_WRITE)
  async note(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: NoteDto, @Req() req: Request) {
    const p = await this.assertPatient(user, id);
    if (dto.amendsId) {
      if (!dto.amendReason) throw new BadRequestException("Explain why this note is being corrected");
      const original = await this.prisma.clinicalNote.findFirst({ where: { id: dto.amendsId, record: { patientId: id } } });
      if (!original) throw new NotFoundException("The note being corrected was not found for this patient");
      const already = await this.prisma.clinicalNote.findFirst({ where: { amendsId: dto.amendsId } });
      if (already) throw new BadRequestException("This note has already been corrected. Correct the latest version instead.");
    }
    const n = await this.prisma.$transaction(async (tx) => {
      const recordId = await this.currentRecordId(tx, id, hospitalOf(user), user.id);
      return tx.clinicalNote.create({
        data: { recordId, authorId: user.id, symptoms: dto.symptoms, treatmentPlan: dto.treatmentPlan, amendsId: dto.amendsId, amendReason: dto.amendsId ? dto.amendReason : null },
      });
    });
    await this.audit.log({ action: dto.amendsId ? "CLINICAL_NOTE_AMEND" : "CLINICAL_NOTE_ADD", entity: `Patient ${p.mrn}`, entityId: n.id, actor: user, req });
    return {
      id: n.id,
      createdAt: n.createdAt.toISOString(),
      author: `${user.role === "DOCTOR" ? "Dr. " : ""}${user.firstName} ${user.lastName}`,
      symptoms: n.symptoms,
      treatmentPlan: n.treatmentPlan,
      amendsId: n.amendsId ?? undefined,
      amendReason: n.amendReason ?? undefined,
    };
  }
}

@Module({ controllers: [RecordsController] })
export class RecordsModule {}

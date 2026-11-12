import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BedStatus, type Bed, type Ward } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { userNames } from "../../common/names";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { toPatientRow } from "../patients/patients.controller";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class BedStatusDto {
  @IsEnum(BedStatus) status: BedStatus;
}

class MedicationDto {
  @IsUUID() patientId: string;
  @Transform(trim) @IsString() @Length(2, 120) medicine: string;
  @Transform(trim) @IsString() @Length(1, 40) dose: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
  /** Display-only; ignored by the server. */
  @IsOptional() @IsString() patientName?: string;
}

/** Which bed changes are allowed. Admitting a patient is done when a bed is assigned (not via this endpoint). */
const BED_FLOW: Record<BedStatus, BedStatus[]> = {
  OCCUPIED: ["CLEANING"], // discharge
  CLEANING: ["AVAILABLE"],
  AVAILABLE: ["RESERVED", "CLEANING"],
  RESERVED: ["AVAILABLE"],
};

const toBedRow = (b: Bed & { ward: Ward; patient: { firstName: string; lastName: string } | null }) => ({
  id: b.id,
  ward: b.ward.name,
  label: b.label,
  type: b.type,
  status: b.status,
  patientId: b.patientId ?? undefined,
  patientName: b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : undefined,
});

@ApiTags("Wards & nursing")
@ApiBearerAuth()
@Controller()
export class WardsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("beds")
  @RequirePermissions(P.BEDS_MANAGE)
  async beds(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.bed.findMany({
      where: { ward: { hospitalId: hospitalOf(user) } },
      include: { ward: true, patient: { select: { firstName: true, lastName: true } } },
      orderBy: [{ ward: { name: "asc" } }, { label: "asc" }],
    });
    return rows.map(toBedRow);
  }

  @Patch("beds/:id")
  @RequirePermissions(P.BEDS_MANAGE)
  async setBed(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: BedStatusDto, @Req() req: Request) {
    const bed = await this.prisma.bed.findFirst({ where: { id, ward: { hospitalId: hospitalOf(user) } }, include: { ward: true } });
    if (!bed) throw new NotFoundException("Bed not found");
    if (!BED_FLOW[bed.status].includes(dto.status)) {
      throw new BadRequestException(bed.status === "OCCUPIED" ? "Discharge the patient first (bed goes to cleaning)." : `Can't change a ${bed.status.toLowerCase()} bed to ${dto.status.toLowerCase()}`);
    }
    const updated = await this.prisma.bed.update({
      where: { id },
      data: { status: dto.status, ...(bed.status === "OCCUPIED" ? { patientId: null } : {}) },
      include: { ward: true, patient: { select: { firstName: true, lastName: true } } },
    });
    await this.audit.log({ action: bed.status === "OCCUPIED" ? "BED_DISCHARGE" : "BED_STATUS", entity: `${bed.ward.name} ${bed.label} → ${dto.status}`, entityId: id, actor: user, req });
    return toBedRow(updated);
  }

  /** In-patients with their bed and latest vitals. */
  @Get("nursing/assigned-patients")
  @RequirePermissions(P.NURSING)
  async assigned(@CurrentUser() user: RequestUser) {
    const beds = await this.prisma.bed.findMany({
      where: { ward: { hospitalId: hospitalOf(user) }, patientId: { not: null } },
      include: {
        ward: true,
        patient: {
          include: {
            allergies: { select: { substance: true } },
            appointments: { where: { status: "COMPLETED" }, orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } },
            records: { include: { vitals: { orderBy: { recordedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 5 },
          },
        },
      },
      orderBy: [{ ward: { name: "asc" } }, { label: "asc" }],
    });
    const latest = beds.map((b) => b.patient!.records.flatMap((r) => r.vitals).sort((x, y) => y.recordedAt.getTime() - x.recordedAt.getTime())[0]);
    const names = await userNames(this.prisma, latest.map((v) => v?.recordedById));
    return beds.map((b, i) => {
      const v = latest[i];
      return {
        bed: toBedRow({ ...b, patient: b.patient }),
        patient: toPatientRow(b.patient!),
        lastVitals: v
          ? {
              id: v.id, recordedAt: v.recordedAt.toISOString(), recordedBy: names.get(v.recordedById) ?? "Unknown",
              systolic: v.systolic ?? undefined, diastolic: v.diastolic ?? undefined, pulse: v.pulse ?? undefined,
              temperatureC: v.temperatureC ? Number(v.temperatureC) : undefined, spo2: v.spo2 ?? undefined,
              heightCm: v.heightCm ? Number(v.heightCm) : undefined, weightKg: v.weightKg ? Number(v.weightKg) : undefined, bmi: v.bmi ? Number(v.bmi) : undefined,
            }
          : undefined,
      };
    });
  }

  @Get("nursing/medication-notes")
  @RequirePermissions(P.NURSING)
  async notes(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.medicationAdministration.findMany({
      where: { hospitalId: hospitalOf(user) },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { givenAt: "desc" },
      take: 100,
    });
    const names = await userNames(this.prisma, rows.map((r) => r.givenById));
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: `${r.patient.firstName} ${r.patient.lastName}`,
      medicine: r.medicine,
      dose: r.dose,
      note: r.note ?? undefined,
      givenAt: r.givenAt.toISOString(),
      givenBy: names.get(r.givenById) ?? "Unknown",
    }));
  }

  @Post("nursing/medication-notes")
  @RequirePermissions(P.NURSING)
  async addNote(@CurrentUser() user: RequestUser, @Body() dto: MedicationDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, hospitalId }, select: { id: true, mrn: true, firstName: true, lastName: true } });
    if (!patient) throw new NotFoundException("Patient not found");
    const r = await this.prisma.medicationAdministration.create({ data: { hospitalId, patientId: patient.id, medicine: dto.medicine, dose: dto.dose, note: dto.note, givenById: user.id } });
    await this.audit.log({ action: "MEDICATION_ADMINISTER", entity: `${patient.mrn}: ${dto.medicine} ${dto.dose}`, entityId: r.id, actor: user, req });
    return {
      id: r.id, patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, medicine: r.medicine, dose: r.dose,
      note: r.note ?? undefined, givenAt: r.givenAt.toISOString(), givenBy: `${user.firstName} ${user.lastName}`,
    };
  }
}

@Module({ controllers: [WardsController] })
export class WardsModule {}

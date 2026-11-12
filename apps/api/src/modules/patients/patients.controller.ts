import { Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Gender, Prisma } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { withUniqueCode } from "../../common/codes";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { Paginated } from "../../common/http";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

class RegisterPatientDto {
  @Transform(trim) @IsString() @Length(2, 50) firstName: string;
  @Transform(trim) @IsString() @Length(1, 50) lastName: string;
  @IsEnum(Gender) gender: Gender;
  @IsDateString() dateOfBirth: string;
  @Transform(({ value }) => (typeof value === "string" ? value.replace(/\s/g, "") : value))
  @Matches(/^\+?[0-9]{10,14}$/, { message: "Enter a valid phone number" })
  phone: string;
  @IsOptional() @IsIn(BLOOD) bloodGroup?: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) allergies: string[] = [];
}

class PatientQuery {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 100;
}

const include = {
  allergies: { select: { substance: true } },
  appointments: { where: { status: "COMPLETED" as const }, orderBy: { startsAt: "desc" as const }, take: 1, select: { startsAt: true } },
} satisfies Prisma.PatientInclude;

type PatientWithExtras = Prisma.PatientGetPayload<{ include: typeof include }>;

/** Maps a DB row to the PatientRow shape shared with the frontend. */
export const toPatientRow = (p: PatientWithExtras) => ({
  id: p.id,
  mrn: p.mrn,
  name: `${p.firstName} ${p.lastName}`,
  gender: p.gender,
  dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
  phone: p.phone,
  bloodGroup: p.bloodGroup ?? undefined,
  allergies: p.allergies.map((a) => a.substance),
  lastVisit: p.appointments[0]?.startsAt.toISOString(),
  createdAt: p.createdAt.toISOString(),
});

@ApiTags("Patients")
@ApiBearerAuth()
@Controller("patients")
export class PatientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Patients of the user's hospital, newest first. `q` matches name, MRN or phone. */
  @Get()
  @RequirePermissions(P.PATIENTS_READ)
  async list(@CurrentUser() user: RequestUser, @Query() query: PatientQuery) {
    const hospitalId = hospitalOf(user);
    const q = query.q;
    const where: Prisma.PatientWhereInput = {
      hospitalId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { mrn: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/\s/g, "") } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({ where, include, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.patient.count({ where }),
    ]);
    return Paginated.of(rows.map(toPatientRow), total, query.page, query.pageSize);
  }

  @Post()
  @RequirePermissions(P.PATIENTS_WRITE)
  async register(@CurrentUser() user: RequestUser, @Body() dto: RegisterPatientDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const created = await withUniqueCode("MC", (mrn) =>
      this.prisma.patient.create({
        data: {
          hospitalId,
          mrn,
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: dto.gender,
          dateOfBirth: new Date(dto.dateOfBirth),
          phone: dto.phone,
          bloodGroup: dto.bloodGroup,
          allergies: { create: dto.allergies.map((substance) => ({ substance })) },
        },
        include,
      }),
    );
    await this.audit.log({ action: "PATIENT_CREATE", entity: `Patient ${created.mrn}`, entityId: created.id, actor: user, req });
    return toPatientRow(created);
  }

  @Get(":id")
  @RequirePermissions(P.PATIENTS_READ)
  async get(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const p = await this.prisma.patient.findFirst({ where: { id, hospitalId: hospitalOf(user) }, include });
    if (!p) throw new NotFoundException("Patient not found");
    await this.audit.log({ action: "PATIENT_VIEW", entity: `Patient ${p.mrn}`, entityId: p.id, actor: user, req });
    return toPatientRow(p);
  }
}

@Module({ controllers: [PatientsController] })
export class PatientsModule {}

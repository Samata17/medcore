import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { randomBytes } from "node:crypto";
import type { RequestUser } from "../../common/auth-types";
import { randomCode } from "../../common/codes";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthModule } from "../auth/auth.module";
import { BCRYPT_ROUNDS } from "../auth/auth.service";
import { OtpService } from "../auth/otp.service";
import { TokenService } from "../auth/token.service";
import { MailService } from "../mail/mail.service";

/** Roles a hospital admin may create (never SUPER_ADMIN or PATIENT). */
const STAFF_ROLES: Role[] = ["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT"];
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class CreateStaffDto {
  /** Full name, e.g. "Dr. Farhan Ali" or "Meera Pillai" */
  @Transform(trim) @IsString() @Length(3, 100) name: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value)) @IsEmail() email: string;
  @IsIn(STAFF_ROLES) role: Role;
  /** Department name (required for doctors) */
  @IsOptional() @Transform(trim) @IsString() @Length(2, 60) department?: string;
  // Optional doctor profile fields; can be completed later.
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) specialization?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(3, 40) licenseNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100000) consultationFee?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) experienceYears?: number;
}

class SetActiveDto {
  @IsBoolean() active: boolean;
}

function splitName(full: string) {
  const parts = full.replace(/^dr\.?\s+/i, "").trim().split(/\s+/);
  return { firstName: parts.slice(0, -1).join(" ") || parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : "-" };
}

@ApiTags("Staff")
@ApiBearerAuth()
@Controller("staff")
export class StaffController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  @Get()
  @RequirePermissions(P.STAFF_MANAGE)
  async list(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.user.findMany({
      where: { hospitalId: hospitalOf(user), role: { in: STAFF_ROLES } },
      include: { department: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    });
    return rows.map((u) => ({
      id: u.id,
      name: `${u.role === "DOCTOR" ? "Dr. " : ""}${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      department: u.department?.name,
      active: u.isActive,
      joinedAt: u.createdAt.toISOString(),
    }));
  }

  /** Creates the account and emails a code so the person sets their own password. */
  @Post()
  @RequirePermissions(P.STAFF_MANAGE)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateStaffDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    if (dto.role === "DOCTOR" && !dto.department) throw new BadRequestException("Doctors must belong to a department");
    const department = dto.department
      ? await this.prisma.department.findUnique({ where: { hospitalId_name: { hospitalId, name: dto.department } } })
      : null;
    if (dto.department && !department) throw new NotFoundException("Department not found");

    const { firstName, lastName } = splitName(dto.name);
    const unusable = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: unusable,
        firstName,
        lastName,
        role: dto.role,
        hospitalId,
        departmentId: department?.id,
        ...(dto.role === "DOCTOR" && department
          ? {
              doctor: {
                create: {
                  hospitalId,
                  departmentId: department.id,
                  specialization: dto.specialization ?? department.name,
                  qualification: "To be updated",
                  licenseNumber: dto.licenseNumber ?? randomCode("PENDING"),
                  experienceYears: dto.experienceYears ?? 0,
                  consultationFee: dto.consultationFee ?? 500,
                  isAvailable: false, // bookable once the profile & hours are completed
                },
              },
            }
          : {}),
      },
    });

    const { code, ttlMinutes } = await this.otp.create(created.id, "PASSWORD_RESET");
    await this.mail.send(
      created.email,
      "Your MedCore staff account",
      `Hello ${created.firstName},\n\nAn account has been created for you. Open the MedCore "Reset password" page and enter this code to choose your password: ${code} (valid ${ttlMinutes} minutes).`,
    );
    await this.audit.log({ action: "STAFF_CREATE", entity: `${dto.role} ${created.email}`, entityId: created.id, actor: user, req });
    return { id: created.id, name: dto.name, email: created.email, role: created.role, department: department?.name, active: true, joinedAt: created.createdAt.toISOString() };
  }

  @Patch(":id")
  @RequirePermissions(P.STAFF_MANAGE)
  async setActive(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SetActiveDto, @Req() req: Request) {
    if (id === user.id) throw new BadRequestException("You can't deactivate your own account");
    const target = await this.prisma.user.findFirst({ where: { id, hospitalId: hospitalOf(user), role: { in: STAFF_ROLES } } });
    if (!target) throw new NotFoundException("Staff member not found");
    const u = await this.prisma.user.update({ where: { id }, data: { isActive: dto.active }, include: { department: { select: { name: true } } } });
    if (!dto.active) await this.tokens.revokeAllForUser(id); // sign out immediately
    await this.audit.log({ action: dto.active ? "STAFF_REACTIVATE" : "STAFF_DEACTIVATE", entity: u.email, entityId: u.id, actor: user, req });
    return {
      id: u.id,
      name: `${u.role === "DOCTOR" ? "Dr. " : ""}${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      department: u.department?.name,
      active: u.isActive,
      joinedAt: u.createdAt.toISOString(),
    };
  }
}

@Module({ imports: [AuthModule], controllers: [StaffController] })
export class StaffModule {}

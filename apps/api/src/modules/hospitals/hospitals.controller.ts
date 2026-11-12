import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { HospitalStatus, Plan } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsString, Length, Matches } from "class-validator";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, Public, RequirePermissions } from "../../common/decorators";
import { P } from "../../common/permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthModule } from "../auth/auth.module";
import { BCRYPT_ROUNDS } from "../auth/auth.service";
import { OtpService } from "../auth/otp.service";
import { MailService } from "../mail/mail.service";

export const PLAN_FEE: Record<Plan, number> = { BASIC: 25_000, PROFESSIONAL: 60_000, ENTERPRISE: 150_000 };
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

class OnboardHospitalDto {
  @Transform(trim) @IsString() @Length(3, 120) name: string;
  @Transform(trim) @IsString() @Length(3, 40) registrationNumber: string;
  @Transform(lower) @IsEmail() email: string;
  @Transform(trim) @Matches(/^\+?[0-9]{10,14}$/) phone: string;
  @Transform(trim) @IsString() @Length(3, 120) line1: string;
  @Transform(trim) @IsString() @Length(2, 60) city: string;
  @Transform(trim) @IsString() @Length(2, 60) state: string;
  @Matches(/^[0-9]{6}$/) postalCode: string;
  @IsEnum(Plan) plan: Plan;
  @Transform(trim) @IsString() @Length(2, 50) adminFirstName: string;
  @Transform(trim) @IsString() @Length(1, 50) adminLastName: string;
  @Transform(lower) @IsEmail() adminEmail: string;
}

class StatusDto {
  @IsEnum(HospitalStatus) status: HospitalStatus;
}
class PlanDto {
  @IsEnum(Plan) plan: Plan;
}

@ApiTags("Hospitals")
@Controller()
export class HospitalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
  ) {}

  /** Active hospitals patients can register with (public, minimal fields). */
  @Public()
  @Get("public/hospitals")
  async publicList() {
    const rows = await this.prisma.hospital.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, address: { select: { city: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((h) => ({ id: h.id, name: h.name, city: h.address?.city ?? "" }));
  }

  @ApiBearerAuth()
  @Get("hospitals")
  @RequirePermissions(P.PLATFORM_MANAGE)
  async list() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const hospitals = await this.prisma.hospital.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        address: { select: { city: true, state: true } },
        subscription: { select: { plan: true } },
        _count: { select: { doctors: true, patients: true } },
      },
    });
    const [beds, revenue] = await Promise.all([
      this.prisma.ward.findMany({ select: { hospitalId: true, _count: { select: { beds: true } } } }).then((wards) => {
        const m = new Map<string, number>();
        for (const w of wards) m.set(w.hospitalId, (m.get(w.hospitalId) ?? 0) + w._count.beds);
        return m;
      }),
      this.prisma.payment
        .findMany({ where: { status: "SUCCEEDED", confirmedAt: { gte: since } }, select: { amount: true, invoice: { select: { hospitalId: true } } } })
        .then((ps) => {
          const m = new Map<string, number>();
          for (const p of ps) m.set(p.invoice.hospitalId, (m.get(p.invoice.hospitalId) ?? 0) + Number(p.amount));
          return m;
        }),
    ]);
    return hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.address?.city ?? "",
      state: h.address?.state ?? "",
      beds: beds.get(h.id) ?? 0,
      doctors: h._count.doctors,
      patients: h._count.patients,
      plan: h.subscription?.plan ?? "BASIC",
      status: h.status,
      onboardedAt: h.createdAt.toISOString(),
      monthlyRevenue: Math.round(revenue.get(h.id) ?? 0),
    }));
  }

  /** Creates a hospital awaiting verification and invites its first admin by email. */
  @ApiBearerAuth()
  @Post("hospitals")
  @RequirePermissions(P.PLATFORM_MANAGE)
  async onboard(@Body() dto: OnboardHospitalDto, @CurrentUser() user: RequestUser, @Req() req: Request) {
    // The admin never receives a password from us: a random unusable one is set,
    // and they choose their own via the emailed reset code.
    const unusable = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
    const hospital = await this.prisma.hospital.create({
      data: {
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        email: dto.email,
        phone: dto.phone,
        address: { create: { line1: dto.line1, city: dto.city, state: dto.state, postalCode: dto.postalCode } },
        subscription: { create: { plan: dto.plan, status: "TRIAL", monthlyFee: PLAN_FEE[dto.plan], currentEnd: new Date(Date.now() + 30 * 86_400_000) } },
        users: {
          create: { email: dto.adminEmail, passwordHash: unusable, firstName: dto.adminFirstName, lastName: dto.adminLastName, role: "HOSPITAL_ADMIN" },
        },
      },
      include: { users: true },
    });
    const admin = hospital.users[0];
    const { code, ttlMinutes } = await this.otp.create(admin.id, "PASSWORD_RESET");
    await this.mail.send(
      admin.email,
      "You're invited to MedCore HMS",
      `Hello ${admin.firstName},\n\n${hospital.name} has been set up on MedCore. To choose your password, open the "Reset password" page and enter this code: ${code} (valid ${ttlMinutes} minutes).\nYou can sign in once the hospital is verified.`,
    );
    await this.audit.log({ action: "HOSPITAL_CREATE", entity: hospital.name, entityId: hospital.id, actor: user, hospitalId: hospital.id, req });
    return { id: hospital.id, status: hospital.status };
  }

  @ApiBearerAuth()
  @Patch("hospitals/:id/status")
  @RequirePermissions(P.PLATFORM_MANAGE)
  async setStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: StatusDto, @CurrentUser() user: RequestUser, @Req() req: Request) {
    const h = await this.prisma.hospital.update({
      where: { id },
      data: { status: dto.status, ...(dto.status === "ACTIVE" ? { verifiedAt: new Date() } : {}) },
    });
    if (dto.status === "SUSPENDED") {
      // Sign every user of the hospital out immediately.
      await this.prisma.refreshToken.updateMany({ where: { user: { hospitalId: id }, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ action: dto.status === "ACTIVE" ? "HOSPITAL_VERIFY" : "HOSPITAL_SUSPEND", entity: h.name, entityId: h.id, actor: user, hospitalId: h.id, req });
    return { id: h.id, name: h.name, status: h.status };
  }

  @ApiBearerAuth()
  @Patch("hospitals/:id/subscription")
  @RequirePermissions(P.PLATFORM_MANAGE)
  async setPlan(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PlanDto, @CurrentUser() user: RequestUser, @Req() req: Request) {
    const sub = await this.prisma.subscription.upsert({
      where: { hospitalId: id },
      create: { hospitalId: id, plan: dto.plan, status: "ACTIVE", monthlyFee: PLAN_FEE[dto.plan], currentEnd: new Date(Date.now() + 30 * 86_400_000) },
      update: { plan: dto.plan, monthlyFee: PLAN_FEE[dto.plan] },
    });
    await this.audit.log({ action: "SUBSCRIPTION_CHANGE", entity: `Plan ${dto.plan}`, entityId: id, actor: user, hospitalId: id, req });
    const h = await this.prisma.hospital.findUniqueOrThrow({ where: { id }, select: { name: true } });
    return { id, name: h.name, plan: sub.plan };
  }
}

@Module({ imports: [AuthModule], controllers: [HospitalsController] })
export class HospitalsModule {}

import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { withUniqueCode } from "../../common/codes";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import type { LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from "./auth.dto";
import { OtpService } from "./otp.service";
import { TokenService } from "./token.service";

export const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Compared against when the email doesn't exist, so response time doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.headers["user-agent"] });

/** The user shape the frontend receives (never includes hashes or flags). */
export const toAuthUser = (
  u: Pick<User, "id" | "email" | "firstName" | "lastName" | "role" | "hospitalId" | "emailVerified"> & { hospital?: { name: string } | null },
) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  hospitalId: u.hospitalId,
  emailVerified: u.emailVerified,
  hospitalName: u.hospital?.name ?? null,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /* ---------------- Registration & email verification ---------------- */

  async register(dto: RegisterDto, req: Request) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Don't reveal that the email is registered; tell the real owner instead.
      await this.mail.send(dto.email, "MedCore sign-up attempt", "Someone tried to create a MedCore account with this email. If it was you, sign in or reset your password instead.");
      return { email: dto.email };
    }

    const hospital = await this.prisma.hospital.findFirst({ where: { id: dto.hospitalId, status: "ACTIVE" }, select: { id: true } });
    if (!hospital) throw new NotFoundException("Hospital not found");

    const phoneTaken = await this.prisma.patient.findUnique({ where: { hospitalId_phone: { hospitalId: hospital.id, phone: dto.phone } } });
    if (phoneTaken) {
      throw new ConflictException("A patient with this phone number is already registered at this hospital. Please ask the front desk to link your online account.");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await withUniqueCode("MC", (mrn) =>
      this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: "PATIENT",
          hospitalId: hospital.id,
          patient: {
            create: {
              hospitalId: hospital.id,
              mrn,
              firstName: dto.firstName,
              lastName: dto.lastName,
              gender: "OTHER", // collected later from the profile / front desk
              dateOfBirth: new Date(dto.dateOfBirth),
              phone: dto.phone,
              email: dto.email,
            },
          },
        },
      }),
    );

    await this.sendCode(user, "EMAIL_VERIFICATION");
    await this.audit.log({ action: "PATIENT_SELF_REGISTER", entity: `User ${user.email}`, entityId: user.id, actor: user, req });
    return { email: user.email };
  }

  private async sendCode(user: Pick<User, "id" | "email" | "firstName">, purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET") {
    const { code, ttlMinutes } = await this.otp.create(user.id, purpose);
    const what = purpose === "EMAIL_VERIFICATION" ? "verify your email" : "reset your password";
    await this.mail.send(
      user.email,
      purpose === "EMAIL_VERIFICATION" ? "Your MedCore verification code" : "Your MedCore password reset code",
      `Hello ${user.firstName},\n\nYour code to ${what} is: ${code}\nIt expires in ${ttlMinutes} minutes. Never share it with anyone.\n\nIf you didn't request this, you can ignore this email.`,
    );
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("The code is invalid or has expired. Request a new one.");
    if (user.emailVerified) return { verified: true as const };
    await this.otp.consume(user.id, "EMAIL_VERIFICATION", dto.otp);
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    return { verified: true as const };
  }

  /** Always reports success so it can't be used to discover accounts. */
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified && !(await this.otp.inCooldown(user.id, "EMAIL_VERIFICATION"))) {
      await this.sendCode(user, "EMAIL_VERIFICATION");
    }
    return { sent: true as const };
  }

  /* ---------------- Sign in / session ---------------- */

  async login(dto: LoginDto, req: Request) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { hospital: { select: { status: true, name: true } } } });
    const wrong = new UnauthorizedException("Incorrect email or password");

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw wrong;
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException("Too many failed attempts. Try again in a few minutes or reset your password.");
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED_LOGINS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
      });
      await this.audit.log({ action: "LOGIN_FAILED", entity: `User ${user.email}`, entityId: user.id, actor: user, req });
      throw wrong;
    }

    if (!user.isActive) throw new ForbiddenException("This account has been deactivated. Contact your hospital administrator.");
    if (user.role !== "SUPER_ADMIN" && user.hospital?.status !== "ACTIVE") throw new ForbiddenException("This hospital is not active on MedCore yet.");
    if (!user.emailVerified) throw new ForbiddenException("Please verify your email address before signing in.");

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const [accessToken, refresh] = await Promise.all([this.tokens.signAccess(user), this.tokens.issueRefresh(user.id, meta(req))]);
    await this.audit.log({ action: "LOGIN", entity: "Session", actor: user, req });
    return { user: toAuthUser(user), accessToken, refresh };
  }

  async refresh(raw: string | undefined, req: Request) {
    const { userId, next } = await this.tokens.rotate(raw, meta(req));
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { hospital: { select: { status: true, name: true } } } });
    if (!user || !user.isActive || (user.role !== "SUPER_ADMIN" && user.hospital?.status !== "ACTIVE")) {
      await this.tokens.revoke(next.raw);
      throw new UnauthorizedException("Not signed in");
    }
    return { user: toAuthUser(user), accessToken: await this.tokens.signAccess(user), refresh: next };
  }

  /* ---------------- Password reset ---------------- */

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !(await this.otp.inCooldown(user.id, "PASSWORD_RESET"))) {
      await this.sendCode(user, "PASSWORD_RESET");
    }
    return { sent: true as const };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("The code is invalid or has expired. Request a new one.");
    await this.otp.consume(user.id, "PASSWORD_RESET", dto.otp);
    await this.prisma.user.update({
      where: { id: user.id },
      // A reset proves email ownership, so it also verifies the email and clears any lock.
      data: { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS), emailVerified: true, failedLogins: 0, lockedUntil: null },
    });
    await this.tokens.revokeAllForUser(user.id); // sign out everywhere
    await this.audit.log({ action: "PASSWORD_RESET", entity: `User ${user.email}`, entityId: user.id, actor: user, req });
    return { reset: true as const };
  }
}

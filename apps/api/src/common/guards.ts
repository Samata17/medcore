import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthedRequest, JwtPayload } from "./auth-types";
import { ANY_PERMISSIONS, IS_PUBLIC, PERMISSIONS } from "./decorators";
import type { Permission } from "./permissions";

/**
 * Global guard #1 — authentication.
 * Verifies the Bearer access token, then re-loads the user so that a
 * deactivated user or a suspended hospital loses access immediately,
 * even if their token hasn't expired yet.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Authentication required");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: env().JWT_ACCESS_SECRET, algorithms: ["HS256"] });
    } catch {
      throw new UnauthorizedException("Your session has expired. Please sign in again.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, hospitalId: true, isActive: true,
        hospital: { select: { status: true } },
        doctor: { select: { id: true } },
        patient: { select: { id: true } },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException("Account is not active");
    if (user.role !== "SUPER_ADMIN" && user.hospital?.status !== "ACTIVE") {
      throw new ForbiddenException("This hospital is not active on MedCore");
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      hospitalId: user.hospitalId,
      doctorId: user.doctor?.id ?? null,
      patientId: user.patient?.id ?? null,
    };
    return true;
  }
}

/**
 * Global guard #2 — authorization (RBAC).
 * Permissions per role come from the RolePermission table, cached for 60 s.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private cache = new Map<Role, { perms: Set<string>; at: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  private async permsFor(role: Role) {
    const hit = this.cache.get(role);
    if (hit && Date.now() - hit.at < 60_000) return hit.perms;
    const rows = await this.prisma.rolePermission.findMany({ where: { role }, select: { permission: true } });
    const perms = new Set(rows.map((r) => r.permission));
    this.cache.set(role, { perms, at: Date.now() });
    return perms;
  }

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS, targets) ?? [];
    const anyOf = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS, targets) ?? [];
    if (required.length === 0 && anyOf.length === 0) return true; // any signed-in user

    const { user } = ctx.switchToHttp().getRequest<AuthedRequest>();
    const perms = await this.permsFor(user.role);
    const ok = required.every((p) => perms.has(p)) && (anyOf.length === 0 || anyOf.some((p) => perms.has(p)));
    if (!ok) throw new ForbiddenException("You don't have permission to do this");
    return true;
  }
}

/**
 * Rate-limit bucket = client IP + submitted email (if any).
 * Hospitals often share one public IP, so limiting login by IP alone would let
 * one person's typos lock out the whole ward. Brute force on a single account
 * is still capped here and by the account lockout in AuthService.
 */
@Injectable()
export class MedcoreThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = (req.ip as string) ?? "unknown";
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" ? `${ip}:${email.trim().toLowerCase()}` : ip;
  }
}

/**
 * CSRF defence for cookie-authenticated endpoints (refresh, logout).
 * Browsers can't send this custom header cross-site without a CORS preflight,
 * which our strict CORS policy rejects for unknown origins.
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.headers["x-medcore-csrf"] !== "1") throw new ForbiddenException("Missing CSRF header");
    return true;
  }
}

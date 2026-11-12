import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/auth-types";

export const REFRESH_COOKIE = "medcore_rt";
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * Access tokens: short-lived JWTs held in browser memory.
 * Refresh tokens: random 384-bit strings in an HTTP-only cookie, stored only as
 * SHA-256 hashes. Every refresh rotates the token; presenting an already-rotated
 * token is treated as theft and revokes the whole login session ("family").
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger("Tokens");
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccess(user: Pick<User, "id" | "role" | "hospitalId">) {
    const payload: JwtPayload = { sub: user.id, role: user.role, hid: user.hospitalId };
    return this.jwt.signAsync(payload, { secret: env().JWT_ACCESS_SECRET, expiresIn: env().JWT_ACCESS_TTL_SECONDS, algorithm: "HS256" });
  }

  async issueRefresh(userId: string, meta: ClientMeta, family: string = randomUUID()) {
    const raw = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + env().REFRESH_TTL_DAYS * 86_400_000);
    const row = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(raw), family, expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 255) },
    });
    return { raw, expiresAt, id: row.id };
  }

  /** Validates and rotates a refresh token. Returns the user id and the new token. */
  async rotate(raw: string | undefined, meta: ClientMeta) {
    if (!raw) throw new UnauthorizedException("Not signed in");
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!current) throw new UnauthorizedException("Not signed in");

    if (current.revokedAt) {
      // A rotated token was used again: likely stolen. Kill the whole session family.
      await this.prisma.refreshToken.updateMany({ where: { family: current.family, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.warn(`Refresh token reuse detected for user ${current.userId}; session family revoked`);
      throw new UnauthorizedException("Session ended for your security. Please sign in again.");
    }
    if (current.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("Session expired. Please sign in again.");

    const next = await this.issueRefresh(current.userId, meta, current.family);
    await this.prisma.refreshToken.update({ where: { id: current.id }, data: { revokedAt: new Date(), replacedBy: next.id } });
    return { userId: current.userId, next };
  }

  async revoke(raw: string | undefined) {
    if (!raw) return;
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: env().COOKIE_SECURE,
      sameSite: env().COOKIE_SAMESITE,
      path: "/api/v1/auth", // only sent to auth endpoints
    };
  }

  setCookie(res: Response, raw: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, raw, { ...this.cookieOptions(), expires: expiresAt });
  }

  clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}

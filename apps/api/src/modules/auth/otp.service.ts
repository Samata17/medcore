import { BadRequestException, Injectable } from "@nestjs/common";
import type { VerificationPurpose } from "@prisma/client";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

/** 6-digit one-time codes, stored only as an HMAC, valid 10 minutes, 5 attempts. */
@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(userId: string, purpose: VerificationPurpose, code: string) {
    return createHmac("sha256", env().OTP_SECRET).update(`${userId}:${purpose}:${code}`).digest("hex");
  }

  /** True if a code was sent less than the cooldown ago (prevents email flooding). */
  async inCooldown(userId: string, purpose: VerificationPurpose) {
    const last = await this.prisma.verificationCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" } });
    return !!last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000;
  }

  async create(userId: string, purpose: VerificationPurpose) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.$transaction([
      // Any older unused code stops working.
      this.prisma.verificationCode.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.verificationCode.create({
        data: { userId, purpose, codeHash: this.hash(userId, purpose, code), expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000) },
      }),
    ]);
    return { code, ttlMinutes: TTL_MINUTES };
  }

  /** Consumes a valid code or throws a generic error. */
  async consume(userId: string, purpose: VerificationPurpose, code: string) {
    const invalid = new BadRequestException("The code is invalid or has expired. Request a new one.");
    const row = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!row || row.attempts >= MAX_ATTEMPTS) throw invalid;

    const expected = Buffer.from(row.codeHash, "hex");
    const actual = Buffer.from(this.hash(userId, purpose, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    await this.prisma.verificationCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  }
}

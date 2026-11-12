import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type Role } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/auth-types";

export interface AuditEntry {
  action: string; // e.g. LOGIN, PATIENT_CREATE, MEDICAL_RECORD_VIEW
  entity: string; // human-readable target, e.g. "Patient MC-100102"
  entityId?: string;
  details?: Record<string, unknown>;
  actor?: Pick<RequestUser, "id" | "role" | "hospitalId"> | null;
  hospitalId?: string | null;
  req?: Request;
}

/**
 * Writes append-only audit rows. Failures are logged but never block the
 * user's action (an audit outage shouldn't stop patient care).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");
  constructor(private readonly prisma: PrismaService) {}

  async log(e: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: e.action,
          entity: e.entity,
          entityId: e.entityId,
          details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
          actorId: e.actor?.id ?? null,
          actorRole: (e.actor?.role as Role | undefined) ?? null,
          hospitalId: e.hospitalId !== undefined ? e.hospitalId : (e.actor?.hospitalId ?? null),
          ip: e.req?.ip ?? null,
          userAgent: e.req?.headers["user-agent"]?.slice(0, 255) ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${e.action}: ${(err as Error).message}`);
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import type { NotificationType, Role } from "@prisma/client";
import type { Server } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

/**
 * Creates in-app notifications and pushes them to connected browsers.
 *
 * Channels: in-app (stored + Socket.IO) is always on. Email/SMS can be added
 * later by extending `deliver()` — every notification already passes through it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("Notifications");
  private server: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Called by the gateway once Socket.IO is ready. */
  attach(server: Server) {
    this.server = server;
  }

  async toUsers(userIds: (string | null | undefined)[], hospitalId: string | null, n: NotifyInput) {
    const ids = [...new Set(userIds.filter((x): x is string => !!x))];
    if (!ids.length) return;
    try {
      const createdAt = new Date();
      await this.prisma.notification.createMany({
        data: ids.map((userId) => ({ userId, hospitalId, type: n.type, title: n.title, body: n.body, href: n.href, createdAt })),
      });
      this.deliver(ids, { ...n, createdAt: createdAt.toISOString() });
    } catch (err) {
      // A notification failure must never break the clinical action that caused it.
      this.logger.error(`Failed to notify: ${(err as Error).message}`);
    }
  }

  /** Notify every active user with one of the roles in a hospital (e.g. all pharmacists). */
  async toRoles(hospitalId: string, roles: Role[], n: NotifyInput) {
    const users = await this.prisma.user.findMany({ where: { hospitalId, role: { in: roles }, isActive: true }, select: { id: true } });
    await this.toUsers(users.map((u) => u.id), hospitalId, n);
  }

  private deliver(userIds: string[], payload: NotifyInput & { createdAt: string }) {
    if (!this.server) return;
    for (const id of userIds) this.server.to(`user:${id}`).emit("notification", payload);
  }
}

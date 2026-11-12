import { Controller, Get, Global, HttpCode, Injectable, Logger, Module, NotFoundException, Param, ParseUUIDPipe, Patch } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in user's latest 50 notifications. */
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href ?? undefined, createdAt: n.createdAt.toISOString(), read: !!n.readAt }));
  }

  @Patch("read-all")
  @HttpCode(200)
  async readAll(@CurrentUser() user: RequestUser) {
    const r = await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }

  @Patch(":id/read")
  @HttpCode(200)
  async read(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    // Scoped by userId so nobody can mark someone else's notification.
    const r = await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
    if (!r.count) throw new NotFoundException("Notification not found");
    return { id };
  }
}

/** Sends a reminder ~24 hours before each confirmed appointment (checked every 15 minutes). */
@Injectable()
export class AppointmentReminderJob {
  private readonly logger = new Logger("Reminders");
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    const now = Date.now();
    const due = await this.prisma.appointment.findMany({
      where: { status: "CONFIRMED", reminderAt: null, startsAt: { gt: new Date(now), lte: new Date(now + 24 * 3_600_000) } },
      include: { patient: { select: { userId: true } }, doctor: { include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } } },
      take: 200,
    });
    for (const a of due) {
      const when = a.startsAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      await this.notifications.toUsers([a.patient.userId], a.hospitalId, {
        type: "APPOINTMENT_REMINDER",
        title: "Appointment reminder",
        body: `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName} (${a.doctor.department.name}), ${when}.`,
        href: "/dashboard/patient/appointments",
      });
      await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderAt: new Date() } });
    }
    if (due.length) this.logger.log(`Sent ${due.length} appointment reminder(s)`);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, AppointmentReminderJob],
  exports: [NotificationsService],
})
export class NotificationsModule {}

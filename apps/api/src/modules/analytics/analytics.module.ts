import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { APPOINTMENT_STATUSES } from "@medcore/types";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { todayRange } from "../../common/names";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { PLAN_FEE } from "../hospitals/hospitals.controller";

/** Last n calendar days (oldest first) as Date at local midnight. */
const lastDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
/** First day of each of the last n months (oldest first). */
const lastMonths = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    return d;
  });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

/** All figures are computed from the database at request time. */
@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("platform")
  @RequirePermissions(P.ANALYTICS_PLATFORM)
  async platform() {
    const months = lastMonths(12);
    const since = months[0];
    const monthStart = months[months.length - 1];

    const [hospitals, patientsTotal, activeDoctors, apptsThisMonth, payments, patientsBefore, newPatients, appts] = await Promise.all([
      this.prisma.hospital.findMany({ select: { status: true, subscription: { select: { plan: true, status: true } } } }),
      this.prisma.patient.count(),
      this.prisma.doctor.count({ where: { user: { isActive: true }, hospital: { status: "ACTIVE" } } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: monthStart } } }),
      this.prisma.payment.findMany({ where: { status: "SUCCEEDED", confirmedAt: { gte: since } }, select: { amount: true, confirmedAt: true } }),
      this.prisma.patient.count({ where: { createdAt: { lt: since } } }),
      this.prisma.patient.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.appointment.findMany({ where: { startsAt: { gte: since } }, select: { startsAt: true } }),
    ]);

    const revenue = new Map<string, number>();
    for (const p of payments) revenue.set(monthKey(p.confirmedAt!), (revenue.get(monthKey(p.confirmedAt!)) ?? 0) + Number(p.amount));
    const joined = new Map<string, number>();
    for (const p of newPatients) joined.set(monthKey(p.createdAt), (joined.get(monthKey(p.createdAt)) ?? 0) + 1);
    const apptCount = new Map<string, number>();
    for (const a of appts) apptCount.set(monthKey(a.startsAt), (apptCount.get(monthKey(a.startsAt)) ?? 0) + 1);

    let running = patientsBefore;
    return {
      totals: {
        hospitals: hospitals.length,
        pendingVerification: hospitals.filter((h) => h.status === "PENDING_VERIFICATION").length,
        patients: patientsTotal,
        activeDoctors,
        appointmentsThisMonth: apptsThisMonth,
        mrr: hospitals
          .filter((h) => h.status === "ACTIVE" && h.subscription?.status === "ACTIVE")
          .reduce((s, h) => s + PLAN_FEE[h.subscription!.plan], 0),
      },
      revenueByMonth: months.map((m) => ({ month: monthLabel(m), revenue: Math.round(revenue.get(monthKey(m)) ?? 0) })),
      patientGrowth: months.map((m) => ({ month: monthLabel(m), patients: (running += joined.get(monthKey(m)) ?? 0) })),
      appointmentsByMonth: months.map((m) => ({ month: monthLabel(m), appointments: apptCount.get(monthKey(m)) ?? 0 })),
    };
  }

  @Get("hospital")
  @RequirePermissions(P.ANALYTICS_HOSPITAL)
  async hospital(@CurrentUser() user: RequestUser) {
    const hospitalId = hospitalOf(user);
    const { from, to } = todayRange();
    const week = lastDays(7);
    const fortnight = lastDays(14);

    const [todayAppts, revenueToday, beds, staff, weekAppts, payments14, departments] = await Promise.all([
      this.prisma.appointment.findMany({ where: { hospitalId, startsAt: { gte: from, lt: to } }, select: { status: true, patientId: true, doctorId: true } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "SUCCEEDED", confirmedAt: { gte: from, lt: to }, invoice: { hospitalId } } }),
      this.prisma.bed.groupBy({ by: ["status"], where: { ward: { hospitalId } }, _count: true }),
      this.prisma.user.findMany({ where: { hospitalId, isActive: true, role: { notIn: ["PATIENT"] } }, select: { role: true } }),
      this.prisma.appointment.findMany({ where: { hospitalId, startsAt: { gte: week[0], lt: to } }, select: { startsAt: true, status: true } }),
      this.prisma.payment.findMany({ where: { status: "SUCCEEDED", confirmedAt: { gte: fortnight[0], lt: to }, invoice: { hospitalId } }, select: { amount: true, confirmedAt: true } }),
      this.prisma.department.findMany({ where: { hospitalId }, select: { name: true, doctors: { select: { id: true } } } }),
    ]);

    const perDoctor = new Map<string, number>();
    for (const a of todayAppts) if (a.status !== "CANCELLED") perDoctor.set(a.doctorId, (perDoctor.get(a.doctorId) ?? 0) + 1);
    const byDay = new Map<string, { completed: number; cancelled: number; noShow: number }>();
    for (const a of weekAppts) {
      const k = dayKey(a.startsAt);
      const cur = byDay.get(k) ?? { completed: 0, cancelled: 0, noShow: 0 };
      if (a.status === "COMPLETED") cur.completed++;
      if (a.status === "CANCELLED") cur.cancelled++;
      if (a.status === "NO_SHOW") cur.noShow++;
      byDay.set(k, cur);
    }
    const revByDay = new Map<string, number>();
    for (const p of payments14) revByDay.set(dayKey(p.confirmedAt!), (revByDay.get(dayKey(p.confirmedAt!)) ?? 0) + Number(p.amount));
    const bedCount = (s: string) => beds.find((b) => b.status === s)?._count ?? 0;

    return {
      today: {
        patients: new Set(todayAppts.filter((a) => a.status !== "CANCELLED").map((a) => a.patientId)).size,
        revenue: Math.round(Number(revenueToday._sum.amount ?? 0)),
        occupiedBeds: bedCount("OCCUPIED"),
        totalBeds: beds.reduce((s, b) => s + b._count, 0),
        activeDoctors: staff.filter((s) => s.role === "DOCTOR").length,
        activeStaff: staff.length,
      },
      weekly: week.map((d) => ({ day: d.toLocaleDateString("en-IN", { weekday: "short" }), ...(byDay.get(dayKey(d)) ?? { completed: 0, cancelled: 0, noShow: 0 }) })),
      revenueTrend: fortnight.map((d) => ({ day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: Math.round(revByDay.get(dayKey(d)) ?? 0) })),
      departments: departments
        .map((d) => ({ name: d.name, patients: d.doctors.reduce((s, doc) => s + (perDoctor.get(doc.id) ?? 0), 0) }))
        .sort((a, b) => b.patients - a.patients),
      statusDistribution: APPOINTMENT_STATUSES.map((status) => ({ status, count: todayAppts.filter((a) => a.status === status).length })),
    };
  }
}

@Module({ controllers: [AnalyticsController] })
export class AnalyticsModule {}

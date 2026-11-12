"use client";

import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@medcore/types";
import { DEPARTMENTS, demoDb } from "@/lib/demo/db";
import { lastDates, lastDays, lastMonths } from "@/lib/demo/time";
import { useHmsQuery } from "@/lib/use-hms-query";

/** Deterministic pseudo-random so SAMPLE charts don't jump on every render. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface PlatformAnalytics {
  totals: { hospitals: number; pendingVerification: number; patients: number; activeDoctors: number; appointmentsThisMonth: number; mrr: number };
  revenueByMonth: { month: string; revenue: number }[];
  patientGrowth: { month: string; patients: number }[];
  appointmentsByMonth: { month: string; appointments: number }[];
}

/** GET /analytics/platform (Super Admin only) */
export const usePlatformAnalytics = () =>
  useHmsQuery<PlatformAnalytics>({
    key: ["analytics", "platform"],
    path: "/analytics/platform",
    demo: () => {
      const hs = demoDb().hospitals;
      const r = seeded(7);
      const months = lastMonths(12);
      let patients = 38_000;
      return {
        totals: {
          hospitals: hs.length,
          pendingVerification: hs.filter((h) => h.status === "PENDING_VERIFICATION").length,
          patients: hs.reduce((s, h) => s + h.patients, 0),
          activeDoctors: hs.filter((h) => h.status === "ACTIVE").reduce((s, h) => s + h.doctors, 0),
          appointmentsThisMonth: 11_482,
          mrr: 486_000,
        },
        revenueByMonth: months.map((month, i) => ({ month, revenue: Math.round(21_000_000 + i * 900_000 + r() * 2_500_000) })),
        patientGrowth: months.map((month) => {
          patients += Math.round(2_400 + r() * 1_400);
          return { month, patients };
        }),
        appointmentsByMonth: months.map((month, i) => ({ month, appointments: Math.round(8_200 + i * 260 + r() * 900) })),
      };
    },
  });

export interface HospitalAnalytics {
  today: { patients: number; revenue: number; occupiedBeds: number; totalBeds: number; activeDoctors: number; activeStaff: number };
  weekly: { day: string; completed: number; cancelled: number; noShow: number }[];
  revenueTrend: { day: string; revenue: number }[];
  departments: { name: string; patients: number }[];
  statusDistribution: { status: AppointmentStatus; count: number }[];
}

/** GET /analytics/hospital (Hospital Admin; scoped to the admin's hospitalId) */
export const useHospitalAnalytics = () =>
  useHmsQuery<HospitalAnalytics>({
    key: ["analytics", "hospital"],
    path: "/analytics/hospital",
    demo: () => {
      const db = demoDb();
      const r = seeded(11);
      const today = new Date().toDateString();
      const todays = db.appointments.filter((a) => new Date(a.startsAt).toDateString() === today);
      const paidToday = db.invoices.filter((i) => new Date(i.issuedAt).toDateString() === today).reduce((s, i) => s + i.paid, 0);
      return {
        today: {
          patients: 142,
          revenue: 384_500 + paidToday,
          occupiedBeds: db.beds.filter((b) => b.status === "OCCUPIED").length,
          totalBeds: db.beds.length,
          activeDoctors: db.staff.filter((s) => s.role === "DOCTOR" && s.active).length,
          activeStaff: db.staff.filter((s) => s.active).length,
        },
        weekly: lastDays(7).map((day) => ({
          day,
          completed: Math.round(95 + r() * 45),
          cancelled: Math.round(6 + r() * 8),
          noShow: Math.round(3 + r() * 6),
        })),
        revenueTrend: lastDates(14).map((day) => ({ day, revenue: Math.round(290_000 + r() * 140_000) })),
        departments: DEPARTMENTS.map((d) => ({ name: d.name, patients: d.patientsToday })).sort((a, b) => b.patients - a.patients),
        statusDistribution: APPOINTMENT_STATUSES.map((status) => ({ status, count: todays.filter((a) => a.status === status).length })),
      };
    },
  });

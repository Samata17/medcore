/**
 * Pure business rules shared by the API (authoritative) and the web app
 * (instant feedback + demo mode). No I/O here, so they're easy to unit test.
 */
import type { AppointmentStatus, LabOrderStatus } from "./index";
import type { LabResultRow, MedicineBatchRow } from "./domain";

/* ---------- Appointments ---------- */

/** Statuses that occupy a doctor's slot. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

/** Allowed status transitions (the appointment lifecycle). */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

interface Slotted {
  id?: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
}

/** True if [start, end) overlaps an active appointment of the same doctor. */
export function hasSlotConflict(existing: Slotted[], doctorId: string, startsAt: string, endsAt: string, ignoreId?: string) {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  return existing.some((a) => {
    if (a.doctorId !== doctorId || !BLOCKING_STATUSES.includes(a.status)) return false;
    if (ignoreId && a.id === ignoreId) return false;
    const as = new Date(a.startsAt).getTime();
    const ae = new Date(a.endsAt).getTime();
    return s < ae && as < e;
  });
}

export interface AvailabilityWindow {
  start: string; // "09:00"
  end: string; // "13:00"
}

/**
 * Generate bookable slots for one day from availability windows,
 * marking slots that are already taken or in the past.
 */
export function generateSlots(
  date: Date,
  windows: AvailabilityWindow[],
  slotMinutes: number,
  booked: Slotted[],
  doctorId: string,
  now = new Date(),
) {
  const slots: { startsAt: string; endsAt: string; available: boolean; label: string }[] = [];
  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    const cursor = new Date(date);
    cursor.setHours(sh, sm, 0, 0);
    const end = new Date(date);
    end.setHours(eh, em, 0, 0);
    while (cursor.getTime() + slotMinutes * 60_000 <= end.getTime()) {
      const startsAt = cursor.toISOString();
      const endsAt = new Date(cursor.getTime() + slotMinutes * 60_000).toISOString();
      const taken = hasSlotConflict(booked, doctorId, startsAt, endsAt);
      slots.push({
        startsAt,
        endsAt,
        available: !taken && cursor.getTime() > now.getTime(),
        label: cursor.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      });
      cursor.setMinutes(cursor.getMinutes() + slotMinutes);
    }
  }
  return slots;
}

/* ---------- Laboratory ---------- */

export const LAB_NEXT_STATUS: Partial<Record<LabOrderStatus, LabOrderStatus>> = {
  ORDERED: "SAMPLE_COLLECTED",
  SAMPLE_COLLECTED: "PROCESSING",
  PROCESSING: "RESULT_ENTERED",
  RESULT_ENTERED: "APPROVED",
};

export type ResultFlag = "LOW" | "HIGH" | "NORMAL";

export function resultFlag(r: Pick<LabResultRow, "value" | "refLow" | "refHigh">): ResultFlag {
  if (r.value < r.refLow) return "LOW";
  if (r.value > r.refHigh) return "HIGH";
  return "NORMAL";
}

export const hasAbnormal = (results?: LabResultRow[]) => !!results?.some((r) => resultFlag(r) !== "NORMAL");

/** Patients may only see lab orders once a technician has approved them. */
export const isPatientVisible = (status: LabOrderStatus) => status === "APPROVED";

/* ---------- Pharmacy ---------- */

export const isExpired = (b: Pick<MedicineBatchRow, "expiresOn">, now = new Date()) => new Date(b.expiresOn).getTime() <= now.getTime();

export function daysToExpiry(b: Pick<MedicineBatchRow, "expiresOn">, now = new Date()) {
  return Math.ceil((new Date(b.expiresOn).getTime() - now.getTime()) / 86_400_000);
}

/**
 * First-in, first-out allocation: take stock from the batch that expires first,
 * skipping expired batches. Throws if there isn't enough sellable stock.
 */
export function allocateFifo(batches: MedicineBatchRow[], medicineId: string, quantity: number, now = new Date()) {
  const usable = batches
    .filter((b) => b.medicineId === medicineId && b.quantity > 0 && !isExpired(b, now))
    .sort((a, b) => new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime());

  const available = usable.reduce((s, b) => s + b.quantity, 0);
  if (available < quantity) {
    throw new Error(`Insufficient stock: ${available} available, ${quantity} required`);
  }

  const picks: { batchId: string; batchNo: string; quantity: number }[] = [];
  let remaining = quantity;
  for (const b of usable) {
    if (remaining === 0) break;
    const take = Math.min(b.quantity, remaining);
    picks.push({ batchId: b.id, batchNo: b.batchNo, quantity: take });
    remaining -= take;
  }
  return picks;
}

/** Total sellable stock per medicine, and whether it is at/below reorder level. */
export function stockSummary(batches: MedicineBatchRow[], now = new Date()) {
  const map = new Map<string, { medicineId: string; name: string; category: string; quantity: number; reorderLevel: number }>();
  for (const b of batches) {
    const cur = map.get(b.medicineId) ?? { medicineId: b.medicineId, name: b.medicineName, category: b.category, quantity: 0, reorderLevel: b.reorderLevel };
    if (!isExpired(b, now)) cur.quantity += b.quantity;
    cur.reorderLevel = Math.max(cur.reorderLevel, b.reorderLevel);
    map.set(b.medicineId, cur);
  }
  return [...map.values()].map((m) => ({ ...m, low: m.quantity <= m.reorderLevel }));
}

/* ---------- Billing ---------- */

export function invoiceTotals(items: { quantity: number; unitPrice: number; taxRate: number }[]) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = items.reduce((s, i) => s + (i.quantity * i.unitPrice * i.taxRate) / 100, 0);
  return { subtotal: r2(subtotal), tax: r2(tax), total: r2(subtotal + tax) };
}

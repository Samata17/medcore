/** Unit tests for the shared business rules (run with: npm test). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateFifo,
  canTransition,
  daysToExpiry,
  generateSlots,
  hasAbnormal,
  hasSlotConflict,
  invoiceTotals,
  isExpired,
  isPatientVisible,
  resultFlag,
  stockSummary,
  type MedicineBatchRow,
} from "../src/index";

const appt = (startsAt: string, endsAt: string, status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" = "CONFIRMED", id = "a1", doctorId = "d1") => ({
  id,
  doctorId,
  startsAt,
  endsAt,
  status,
});

describe("appointment lifecycle", () => {
  it("allows the normal path", () => {
    assert.ok(canTransition("PENDING", "CONFIRMED"));
    assert.ok(canTransition("CONFIRMED", "IN_PROGRESS"));
    assert.ok(canTransition("IN_PROGRESS", "COMPLETED"));
  });
  it("blocks skipping steps and reopening finished appointments", () => {
    assert.equal(canTransition("PENDING", "COMPLETED"), false);
    assert.equal(canTransition("COMPLETED", "PENDING"), false);
    assert.equal(canTransition("CANCELLED", "CONFIRMED"), false);
    assert.equal(canTransition("IN_PROGRESS", "CANCELLED"), false);
  });
});

describe("slot conflicts", () => {
  const booked = [appt("2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z")];
  it("detects an exact or partial overlap with the same doctor", () => {
    assert.ok(hasSlotConflict(booked, "d1", "2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z"));
    assert.ok(hasSlotConflict(booked, "d1", "2026-11-10T04:10:00Z", "2026-11-10T04:25:00Z"));
  });
  it("treats back-to-back slots as free (end is exclusive)", () => {
    assert.equal(hasSlotConflict(booked, "d1", "2026-11-10T04:15:00Z", "2026-11-10T04:30:00Z"), false);
    assert.equal(hasSlotConflict(booked, "d1", "2026-11-10T03:45:00Z", "2026-11-10T04:00:00Z"), false);
  });
  it("ignores other doctors, cancelled/completed bookings and the appointment itself", () => {
    assert.equal(hasSlotConflict(booked, "d2", "2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z"), false);
    const done = [appt("2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z", "CANCELLED"), appt("2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z", "COMPLETED", "a2")];
    assert.equal(hasSlotConflict(done, "d1", "2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z"), false);
    assert.equal(hasSlotConflict(booked, "d1", "2026-11-10T04:00:00Z", "2026-11-10T04:15:00Z", "a1"), false);
  });
});

describe("slot generation", () => {
  const day = new Date(2026, 10, 10); // local date
  const at = (h: number, m: number) => new Date(2026, 10, 10, h, m).toISOString();
  const earlier = new Date(2026, 10, 9, 12, 0);

  it("splits each window into whole slots", () => {
    const slots = generateSlots(day, [{ start: "09:00", end: "10:00" }, { start: "14:00", end: "14:40" }], 15, [], "d1", earlier);
    assert.equal(slots.length, 4 + 2); // 14:30–14:45 doesn't fit before 14:40
    assert.equal(slots[0].startsAt, at(9, 0));
    assert.equal(slots.at(-1)!.startsAt, at(14, 15));
    assert.ok(slots.every((s) => s.available));
  });
  it("marks booked and past slots unavailable", () => {
    const booked = [appt(at(9, 15), at(9, 30))];
    const now = new Date(2026, 10, 10, 9, 40);
    const slots = generateSlots(day, [{ start: "09:00", end: "10:00" }], 15, booked, "d1", now);
    assert.deepEqual(slots.map((s) => s.available), [false, false, false, true]);
  });
});

describe("lab results", () => {
  it("flags values outside the reference range", () => {
    assert.equal(resultFlag({ value: 4, refLow: 5, refHigh: 10 }), "LOW");
    assert.equal(resultFlag({ value: 11, refLow: 5, refHigh: 10 }), "HIGH");
    assert.equal(resultFlag({ value: 10, refLow: 5, refHigh: 10 }), "NORMAL"); // limits are inclusive
  });
  it("detects any abnormal parameter", () => {
    const r = (value: number) => ({ parameter: "x", value, unit: "u", refLow: 1, refHigh: 2 });
    assert.equal(hasAbnormal([r(1.5), r(2)]), false);
    assert.equal(hasAbnormal([r(1.5), r(3)]), true);
    assert.equal(hasAbnormal(undefined), false);
  });
  it("shows reports to patients only after approval", () => {
    assert.equal(isPatientVisible("RESULT_ENTERED"), false);
    assert.equal(isPatientVisible("APPROVED"), true);
  });
});

describe("pharmacy stock", () => {
  const now = new Date("2026-11-08T00:00:00Z");
  const batch = (id: string, expiresOn: string, quantity: number, medicineId = "m1"): MedicineBatchRow =>
    ({ id, batchNo: id, medicineId, medicineName: "Paracetamol", category: "Analgesic", expiresOn, quantity, reorderLevel: 50 }) as MedicineBatchRow;
  const batches = [batch("LATE", "2027-12-01", 100), batch("EXPIRED", "2026-10-01", 500), batch("SOON", "2027-01-01", 30), batch("OTHER", "2026-12-01", 999, "m2")];

  it("takes stock from the earliest-expiring valid batch first", () => {
    assert.deepEqual(allocateFifo(batches, "m1", 50, now), [
      { batchId: "SOON", batchNo: "SOON", quantity: 30 },
      { batchId: "LATE", batchNo: "LATE", quantity: 20 },
    ]);
  });
  it("never counts expired stock and refuses to oversell", () => {
    assert.throws(() => allocateFifo(batches, "m1", 131, now), /Insufficient stock: 130 available, 131 required/);
  });
  it("calculates expiry and low stock", () => {
    assert.ok(isExpired({ expiresOn: "2026-11-08T00:00:00Z" }, now)); // expires at that instant
    assert.equal(daysToExpiry({ expiresOn: "2026-11-18T00:00:00Z" }, now), 10);
    const m1 = stockSummary(batches, now).find((s) => s.medicineId === "m1")!;
    assert.equal(m1.quantity, 130);
    assert.equal(m1.low, false);
    assert.equal(stockSummary([batch("A", "2027-01-01", 50)], now)[0].low, true); // at reorder level
  });
});

describe("invoice totals", () => {
  it("applies tax per line and rounds to paise", () => {
    assert.deepEqual(
      invoiceTotals([
        { quantity: 1, unitPrice: 900, taxRate: 0 },
        { quantity: 30, unitPrice: 10, taxRate: 12 },
        { quantity: 3, unitPrice: 33.33, taxRate: 5 },
      ]),
      { subtotal: 1299.99, tax: 41, total: 1340.99 },
    );
  });
  it("is zero for an empty invoice", () => {
    assert.deepEqual(invoiceTotals([]), { subtotal: 0, tax: 0, total: 0 });
  });
});

/**
 * End-to-end clinical workflow: booking → consultation → prescription & pharmacy →
 * laboratory → billing → analytics/notifications/wards. Fresh fictional seed data.
 * Run with: npm run test:e2e
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateSlots } from "@medcore/types";
import { io, type Socket } from "socket.io-client";
import { client, startTestApp, type TestApp } from "./harness";

let app: TestApp;
let api: ReturnType<typeof client>;
const t: Record<string, string> = {}; // access tokens by role
const events: string[] = [];
let sock: Socket;

const waitFor = async (type: string) => {
  for (let i = 0; i < 40; i++) {
    if (events.includes(type)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

before(async () => {
  app = await startTestApp();
  api = client(app.base);
  const accounts = {
    rec: "arjun.nair@sunrise.test",
    doc: "kavita.sharma@sunrise.test",
    lab: "sneha.joshi@sunrise.test",
    pharm: "vikram.desai@sunrise.test",
    acct: "pooja.iyer@sunrise.test",
    pat: "rohan.kulkarni@patient.test",
    admin: "rahul.mehta@sunrise.test",
    sa: "superadmin@medcore.test",
    nurse: "joseph.thomas@sunrise.test",
    metroRec: "mohit.jain@metroheart.test",
    metroAdmin: "ravi.menon@metroheart.test",
  };
  for (const [k, email] of Object.entries(accounts)) {
    const s = await api.login(email);
    assert.ok(s.token, `login ${email}`);
    t[k] = s.token!;
  }
});

after(async () => {
  sock?.close();
  await app?.close();
});

describe("real-time notifications", () => {
  it("patient connects with their token", async () => {
    sock = io(`${app.origin}/notifications`, { auth: { token: t.pat }, transports: ["websocket"] });
    await new Promise<void>((resolve, reject) => {
      sock.on("connect", () => resolve());
      setTimeout(() => reject(new Error("socket did not connect")), 5000);
    });
    sock.on("notification", (n: { type: string }) => events.push(n.type));
  });

  it("a forged token is disconnected", async () => {
    const bad = io(`${app.origin}/notifications`, { auth: { token: "forged" }, transports: ["websocket"] });
    const dropped = await new Promise((r) => {
      bad.on("disconnect", () => r(true));
      setTimeout(() => r(false), 3000);
    });
    bad.close();
    assert.ok(dropped);
  });
});

/* Shared state across the workflow */
let kavita: { id: string };
let slots: { startsAt: string; endsAt: string }[] = [];
let patients: { id: string; name: string }[] = [];
const byName = (n: string) => patients.find((p) => p.name === n)!;
let raceWinnerId = "";
let ownApptId = "";

describe("appointments", () => {
  before(async () => {
    const doctors = (await api.call("/doctors", { token: t.rec })).data;
    kavita = doctors.find((d: { name: string }) => d.name === "Dr. Kavita Sharma");
    const avail = (await api.call(`/doctors/${kavita.id}/availability`, { token: t.rec })).data;
    const taken = (await api.call(`/doctors/${kavita.id}/appointments`, { token: t.rec })).data;
    for (let d = 2; d < 14 && slots.length < 3; d++) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + d);
      if (!avail.weekdays.includes(day.getDay())) continue;
      slots = generateSlots(day, avail.windows, avail.slotMinutes, taken, kavita.id).filter((s) => s.available);
    }
    patients = (await api.call("/patients", { token: t.rec })).data;
  });

  it("free slots are computed from the doctor's working hours", () => {
    assert.ok(slots.length >= 3);
  });

  it("two simultaneous bookings of one slot → exactly one succeeds", async () => {
    const s = slots[0];
    const race = await Promise.all(
      ["Priya Das", "Neha Gupta"].map((n) =>
        api.call("/appointments", { method: "POST", token: t.rec, body: { patientId: byName(n).id, doctorId: kavita.id, startsAt: s.startsAt, endsAt: s.endsAt, reason: "Race test booking" } }),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    raceWinnerId = race.find((r) => r.status === 201)!.data.id;
  });

  it("bookings off the doctor's slot grid are refused", async () => {
    const start = new Date(new Date(slots[1].startsAt).getTime() + 7 * 60_000);
    const r = await api.call("/appointments", {
      method: "POST",
      token: t.rec,
      body: { patientId: byName("Neha Gupta").id, doctorId: kavita.id, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 15 * 60_000).toISOString(), reason: "Odd time" },
    });
    assert.equal(r.status, 400);
  });

  it("patients always book for themselves, and can't create emergencies", async () => {
    const own = await api.call("/appointments", {
      method: "POST",
      token: t.pat,
      body: { patientId: byName("Priya Das").id, doctorId: kavita.id, startsAt: slots[1].startsAt, endsAt: slots[1].endsAt, reason: "Follow-up (self-booked)" },
    });
    assert.equal(own.status, 201);
    assert.equal(own.data.patientName, "Rohan Kulkarni");
    assert.equal(own.data.status, "PENDING");
    ownApptId = own.data.id;
    const emerg = await api.call("/appointments", {
      method: "POST",
      token: t.pat,
      body: { patientId: byName("Rohan Kulkarni").id, doctorId: kavita.id, startsAt: slots[2].startsAt, endsAt: slots[2].endsAt, reason: "x emergency", emergency: true },
    });
    assert.equal(emerg.status, 403);
  });

  it("confirmation reaches the patient in real time", async () => {
    const r = await api.call(`/appointments/${ownApptId}/status`, { method: "PATCH", token: t.rec, body: { status: "CONFIRMED" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.status, "CONFIRMED");
    assert.ok(await waitFor("APPOINTMENT_CONFIRMED"));
  });

  it("enforces the lifecycle and ownership", async () => {
    const skip = await api.call(`/appointments/${raceWinnerId}/status`, { method: "PATCH", token: t.rec, body: { status: "COMPLETED" } });
    assert.ok([400, 403].includes(skip.status), "PENDING → COMPLETED");
    const others = await api.call(`/appointments/${raceWinnerId}/status`, { method: "PATCH", token: t.pat, body: { status: "CANCELLED" } });
    assert.equal(others.status, 404, "patient cancelling someone else's");
  });

  it("other hospitals can't touch or book across tenants", async () => {
    assert.equal((await api.call(`/appointments/${ownApptId}/status`, { method: "PATCH", token: t.metroRec, body: { status: "CANCELLED" } })).status, 404);
    const x = await api.call("/appointments", {
      method: "POST",
      token: t.metroRec,
      body: { patientId: byName("Priya Das").id, doctorId: kavita.id, startsAt: slots[2].startsAt, endsAt: slots[2].endsAt, reason: "cross tenant" },
    });
    assert.equal(x.status, 404);
  });
});

describe("consultation and medical record", () => {
  let suresh: { id: string };
  before(() => {
    suresh = byName("Suresh Iyer");
  });

  it("front desk checks in; doctor starts the consultation", async () => {
    const today = (await api.call("/appointments?date=today", { token: t.rec })).data;
    const appt = today.find((a: { patientName: string; status: string }) => a.patientName === "Suresh Iyer" && a.status === "CONFIRMED");
    assert.ok(appt, "seeded confirmed appointment today");
    const ci = await api.call(`/appointments/${appt.id}/check-in`, { method: "POST", token: t.rec });
    assert.equal(ci.status, 200);
    assert.ok(ci.data.checkedInAt);
    const start = await api.call(`/appointments/${appt.id}/status`, { method: "PATCH", token: t.doc, body: { status: "IN_PROGRESS" } });
    assert.equal(start.data.status, "IN_PROGRESS");
  });

  it("vitals: BMI is computed by the server; blood pressure needs both values", async () => {
    const v = await api.call(`/patients/${suresh.id}/vitals`, {
      method: "POST",
      token: t.doc,
      body: { systolic: 150, diastolic: 95, pulse: 104, temperatureC: 37.2, spo2: 95, heightCm: 170, weightKg: 77 },
    });
    assert.equal(v.status, 201);
    assert.equal(v.data.bmi, 26.6);
    assert.equal((await api.call(`/patients/${suresh.id}/vitals`, { method: "POST", token: t.doc, body: { systolic: 120 } })).status, 400);
  });

  it("diagnoses and notes are append-only; a note can be corrected once", async () => {
    assert.equal((await api.call(`/patients/${suresh.id}/diagnoses`, { method: "POST", token: t.doc, body: { code: "I20.9", description: "Angina pectoris, unspecified", type: "PROVISIONAL" } })).status, 201);
    const note = await api.call(`/patients/${suresh.id}/notes`, { method: "POST", token: t.doc, body: { symptoms: "Chest pain on exertion, 30 min", treatmentPlan: "ECG, troponin" } });
    const fix = await api.call(`/patients/${suresh.id}/notes`, {
      method: "POST",
      token: t.doc,
      body: { symptoms: "Chest pain on exertion, 45 min", treatmentPlan: "ECG, troponin", amendsId: note.data.id, amendReason: "Duration corrected" },
    });
    const fix2 = await api.call(`/patients/${suresh.id}/notes`, { method: "POST", token: t.doc, body: { symptoms: "x x x", treatmentPlan: "y y y", amendsId: note.data.id, amendReason: "again" } });
    assert.equal(note.status, 201);
    assert.equal(fix.status, 201);
    assert.equal(fix.data.amendsId, note.data.id);
    assert.equal(fix2.status, 400);
    const record = (await api.call(`/patients/${suresh.id}/record`, { token: t.doc })).data;
    assert.ok(record.diagnoses.some((d: { code: string }) => d.code === "I20.9"));
    assert.equal(record.notes.filter((n: { symptoms: string }) => n.symptoms.startsWith("Chest pain on exertion")).length, 2, "original kept");
  });

  it("nurses can't add diagnoses", async () => {
    const r = await api.call(`/patients/${suresh.id}/diagnoses`, { method: "POST", token: t.nurse, body: { description: "Not allowed", type: "FINAL" } });
    assert.equal(r.status, 403);
  });
});

describe("prescriptions and pharmacy", () => {
  let batches: { medicineId: string; medicineName: string; batchNo: string }[];
  before(async () => {
    batches = (await api.call("/pharmacy/batches", { token: t.doc })).data;
  });

  it("dispenses from the earliest-expiring valid batch, only once", async () => {
    const pcm = batches.find((b) => b.medicineName === "Paracetamol 500 mg")!;
    const rx = await api.call(`/patients/${byName("Suresh Iyer").id}/prescriptions`, {
      method: "POST",
      token: t.doc,
      body: { items: [{ medicineId: pcm.medicineId, dosage: "500 mg", frequency: "1-1-1", durationDays: 5, quantity: 15, instructions: "After meals" }] },
    });
    assert.equal(rx.status, 201);
    assert.match(rx.data.code, /^RX-\d{5}$/);
    const d = await api.call(`/pharmacy/prescriptions/${rx.data.id}/dispense`, { method: "POST", token: t.pharm });
    assert.equal(d.status, 200);
    assert.match(d.data.picks.join(), /PCM-2207/);
    assert.equal((await api.call(`/pharmacy/prescriptions/${rx.data.id}/dispense`, { method: "POST", token: t.pharm })).status, 400);
    const moves = await app.db.stockMovement.count({ where: { type: "DISPENSED" } });
    assert.ok(moves >= 1, "stock movement logged");
  });

  it("never dispenses expired stock", async () => {
    const met = batches.find((b) => b.batchNo === "MET-2212")!;
    const rx = await api.call(`/patients/${byName("Suresh Iyer").id}/prescriptions`, {
      method: "POST",
      token: t.doc,
      body: { items: [{ medicineId: met.medicineId, dosage: "500 mg", frequency: "1-0-1", durationDays: 180, quantity: 360 }] },
    });
    const d = await api.call(`/pharmacy/prescriptions/${rx.data.id}/dispense`, { method: "POST", token: t.pharm });
    assert.equal(d.status, 400);
    assert.match(d.msg!, /300 available/);
  });

  it("refuses to receive already-expired stock", async () => {
    const r = await api.call("/pharmacy/batches", {
      method: "POST",
      token: t.pharm,
      body: { medicineId: batches[0].medicineId, batchNo: "OLD-1", manufacturedOn: "2023-01-01", expiresOn: "2024-01-01", quantity: 10, unitCost: 1, mrp: 2 },
    });
    assert.equal(r.status, 400);
  });
});

describe("laboratory", () => {
  let orderId = "";
  let attachmentId = "";

  it("doctor orders a test; the patient can't see it yet", async () => {
    const o = await api.call(`/patients/${byName("Rohan Kulkarni").id}/lab-orders`, { method: "POST", token: t.doc, body: { testName: "Lipid profile", priority: "URGENT" } });
    assert.equal(o.status, 201);
    assert.equal(o.data.status, "ORDERED");
    orderId = o.data.id;
    const mine = (await api.call("/me/record", { token: t.pat })).data;
    assert.ok(!mine.labOrders.some((x: { id: string }) => x.id === orderId));
  });

  it("collect → process → results with server-side reference ranges", async () => {
    await api.call(`/lab/orders/${orderId}/advance`, { method: "POST", token: t.lab });
    assert.equal((await api.call(`/lab/orders/${orderId}/advance`, { method: "POST", token: t.lab })).data.status, "PROCESSING");
    const wrong = await api.call(`/lab/orders/${orderId}/results`, { method: "POST", token: t.lab, body: { results: [{ parameter: "LDL", value: 120, unit: "x", refLow: 0, refHigh: 999 }] } });
    assert.equal(wrong.status, 400, "must cover the configured parameters");
    const res = await api.call(`/lab/orders/${orderId}/results`, {
      method: "POST",
      token: t.lab,
      body: {
        results: ["Total cholesterol:245", "LDL:165", "HDL:45", "Triglycerides:140"].map((s) => {
          const [parameter, value] = s.split(":");
          return { parameter, value: Number(value), unit: "mg/dL", refLow: 0, refHigh: 9999 };
        }),
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.results.find((r: { parameter: string }) => r.parameter === "LDL").refHigh, 130, "client range ignored");
  });

  it("accepts a real PDF and rejects disguised or oversized files", async () => {
    const form = (bytes: Buffer, name: string) => {
      const f = new FormData();
      f.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), name);
      return f;
    };
    const up = await api.call(`/lab/orders/${orderId}/report`, { method: "POST", token: t.lab, form: form(Buffer.from("%PDF-1.4\n% fictional test report\n%%EOF"), "lipid.pdf") });
    assert.equal(up.status, 201);
    attachmentId = up.data.id;
    assert.equal((await api.call(`/lab/orders/${orderId}/report`, { method: "POST", token: t.lab, form: form(Buffer.from("MZ not a pdf"), "virus.pdf") })).status, 400);
    const big = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(6 * 1024 * 1024)]);
    assert.equal((await api.call(`/lab/orders/${orderId}/report`, { method: "POST", token: t.lab, form: form(big, "big.pdf") })).status, 413);
    assert.equal((await api.call(`/lab/orders/${orderId}/report`, { method: "POST", token: t.pat, form: form(Buffer.from("%PDF-1.4"), "x.pdf") })).status, 403, "patients can't upload");
  });

  it("the report is hidden from the patient until approved", async () => {
    const early = await fetch(`${app.base}/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${t.pat}` } });
    assert.equal(early.status, 404);
    const appr = await api.call(`/lab/orders/${orderId}/approve`, { method: "POST", token: t.lab });
    assert.equal(appr.data.status, "APPROVED");
    assert.equal(appr.data.approvedBy, "Sneha Joshi");
    assert.ok(await waitFor("LAB_REPORT_APPROVED"));
    const mine = (await api.call("/me/record", { token: t.pat })).data;
    assert.ok(mine.labOrders.some((x: { id: string }) => x.id === orderId));
    const dl = await fetch(`${app.base}/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${t.pat}` } });
    assert.equal(dl.status, 200);
    assert.ok((await dl.text()).startsWith("%PDF"));
  });

  it("another hospital can't download it", async () => {
    const x = await fetch(`${app.base}/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${t.metroAdmin}` } });
    assert.equal(x.status, 404);
  });
});

describe("billing and payments", () => {
  let invoiceId = "";

  it("server applies GST and ignores the browser's tax rate", async () => {
    const inv = await api.call("/billing/invoices", {
      method: "POST",
      token: t.acct,
      body: {
        patientId: byName("Rohan Kulkarni").id,
        items: [
          { category: "CONSULTATION", description: "Consultation", quantity: 1, unitPrice: 900, taxRate: 0 },
          { category: "PHARMACY", description: "Atorvastatin 20 mg", quantity: 30, unitPrice: 10, taxRate: 0 },
        ],
      },
    });
    assert.equal(inv.status, 201);
    assert.equal(inv.data.tax, 36);
    assert.equal(inv.data.total, 1236);
    invoiceId = inv.data.id;
    assert.ok(await waitFor("INVOICE_ISSUED"));
  });

  it("partial payment, then overpayment refused", async () => {
    const p = await api.call(`/billing/invoices/${invoiceId}/payments`, { method: "POST", token: t.acct, body: { amount: 500, method: "CASH" } });
    assert.equal(p.status, 201);
    assert.equal(p.data.status, "PARTIALLY_PAID");
    assert.equal((await api.call(`/billing/invoices/${invoiceId}/payments`, { method: "POST", token: t.acct, body: { amount: 5000, method: "CASH" } })).status, 400);
  });

  it("two cashiers collecting the same balance at once → only one succeeds", async () => {
    const both = await Promise.all([1, 2].map(() => api.call(`/billing/invoices/${invoiceId}/payments`, { method: "POST", token: t.acct, body: { amount: 736, method: "UPI" } })));
    assert.deepEqual(both.map((r) => r.status).sort(), [201, 400]);
    const mine = (await api.call("/me/invoices", { token: t.pat })).data.find((i: { id: string }) => i.id === invoiceId);
    assert.equal(mine.status, "PAID");
    assert.equal(mine.paid, 1236);
  });

  it("online payment says 'not configured' without keys, and can't be faked", async () => {
    assert.equal((await api.call("/billing/config", { token: t.pat })).data.online, false);
    assert.equal((await api.call(`/billing/invoices/${invoiceId}/online-order`, { method: "POST", token: t.pat })).status, 503);
    const forged = await api.call("/billing/payments/razorpay/verify", { method: "POST", token: t.pat, body: { orderId: "order_fake123", paymentId: "pay_fake123", signature: "0".repeat(64) } });
    assert.ok([401, 503].includes(forged.status));
    const hook = await api.call("/billing/webhooks/razorpay", { method: "POST", body: { event: "payment.captured" }, headers: { "x-razorpay-signature": "0".repeat(64) } });
    assert.equal(hook.status, 401, "unsigned webhook");
  });
});

describe("analytics, notifications and wards", () => {
  it("hospital and platform analytics come from live data, with role checks", async () => {
    const h = await api.call("/analytics/hospital", { token: t.admin });
    assert.equal(h.status, 200);
    assert.ok(h.data.today.totalBeds > 0);
    assert.equal(h.data.weekly.length, 7);
    assert.equal(h.data.revenueTrend.length, 14);
    const p = await api.call("/analytics/platform", { token: t.sa });
    assert.equal(p.data.totals.hospitals, 3);
    assert.equal(p.data.revenueByMonth.length, 12);
    assert.equal((await api.call("/analytics/hospital", { token: t.doc })).status, 403);
    assert.equal((await api.call("/analytics/platform", { token: t.admin })).status, 403);
  });

  it("notifications are stored and can be marked read", async () => {
    const n = await api.call("/notifications", { token: t.pat });
    assert.ok(n.data.length >= 3);
    assert.ok(n.data.some((x: { read: boolean }) => !x.read));
    await api.call("/notifications/read-all", { method: "PATCH", token: t.pat });
    assert.ok((await api.call("/notifications", { token: t.pat })).data.every((x: { read: boolean }) => x.read));
    const pharm = (await api.call("/notifications", { token: t.pharm })).data;
    assert.ok(pharm.some((x: { type: string }) => x.type === "PRESCRIPTION_READY"));
  });

  it("nurse sees in-patients with their latest vitals and records medication", async () => {
    const before = (await api.call("/nursing/assigned-patients", { token: t.nurse })).data;
    assert.ok(before.length > 0);
    const patient = before[0].patient;
    assert.equal((await api.call(`/patients/${patient.id}/vitals`, { method: "POST", token: t.nurse, body: { pulse: 82, spo2: 98 } })).status, 201);
    const ward = (await api.call("/nursing/assigned-patients", { token: t.nurse })).data;
    assert.ok(ward.find((w: { patient: { id: string } }) => w.patient.id === patient.id).lastVitals);
    const med = await api.call("/nursing/medication-notes", { method: "POST", token: t.nurse, body: { patientId: patient.id, medicine: "Paracetamol 500 mg", dose: "1 tab", note: "Given after meals" } });
    assert.equal(med.status, 201);
    assert.equal(med.data.patientName, patient.name);
  });

  it("bed discharge goes through cleaning before becoming available", async () => {
    const beds = (await api.call("/beds", { token: t.nurse })).data;
    const occ = beds.find((b: { status: string }) => b.status === "OCCUPIED");
    assert.equal((await api.call(`/beds/${occ.id}`, { method: "PATCH", token: t.nurse, body: { status: "AVAILABLE" } })).status, 400);
    const clean = await api.call(`/beds/${occ.id}`, { method: "PATCH", token: t.nurse, body: { status: "CLEANING" } });
    assert.equal(clean.status, 200);
    assert.ok(!clean.data.patientName);
  });
});

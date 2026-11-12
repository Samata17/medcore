"use client";

/**
 * Data hooks for every module.
 * Live mode -> the REST endpoint shown in each hook (NestJS API, Stage 4/5).
 * Demo mode -> the in-memory sample dataset, following the same business rules.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LAB_NEXT_STATUS,
  allocateFifo,
  canTransition,
  hasSlotConflict,
  invoiceTotals,
  isPatientVisible,
  type AppointmentRow,
  type AppointmentStatus,
  type AuditLogRow,
  type BedRow,
  type ClaimRow,
  type DepartmentRow,
  type DiagnosisRow,
  type DoctorRow,
  type EncounterNote,
  type HospitalRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type LabOrderRow,
  type LabResultRow,
  type MedicationNote,
  type MedicineBatchRow,
  type PatientRow,
  type PaymentMethod,
  type PrescriptionItemRow,
  type PrescriptionRow,
  type StaffRow,
  type VitalRow,
} from "@medcore/types";
import { authFetch } from "@/lib/api";
import { DEPARTMENTS, DOCTORS, demoDb, nextId, snapshot } from "@/lib/demo/db";
import { calculateBmi } from "@/lib/format";
import { useHmsQuery } from "@/lib/use-hms-query";
import { useAuthStore } from "@/stores/auth-store";

/** The demo doctor and patient that "me" refers to in demo mode. */
export const DEMO_DOCTOR_ID = "doc-1";
export const DEMO_PATIENT_ID = "pat-1";

const actorName = () => {
  const u = useAuthStore.getState().user;
  return u ? `${u.role === "DOCTOR" ? "Dr. " : ""}${u.firstName} ${u.lastName}` : "Unknown";
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/* ------------------------------------------------------------------ */
/* Mutation helper                                                     */
/* ------------------------------------------------------------------ */

function useHmsMutation<V, R = unknown>({
  live,
  demo,
  invalidate,
  success,
}: {
  live: (v: V) => Promise<R>;
  demo: (v: V) => R;
  /** Query-key names to refetch afterwards. */
  invalidate: string[];
  success?: string | ((r: R, v: V) => string);
}) {
  const mode = useAuthStore((s) => s.mode);
  const qc = useQueryClient();
  return useMutation<R, Error, V>({
    mutationFn: async (v) => (mode === "demo" ? demo(v) : live(v)),
    onSuccess: (r, v) => {
      qc.invalidateQueries({ predicate: (q) => invalidate.includes(String(q.queryKey[1])) });
      if (success) {
        const msg = typeof success === "function" ? success(r, v) : success;
        toast.success(msg, mode === "demo" ? { description: "Demo mode: kept in this tab only, not saved to a server." } : undefined);
      }
    },
    onError: (e) => toast.error(e.message),
  });
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body ? JSON.stringify(body) : undefined });

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const useDepartments = () =>
  useHmsQuery<DepartmentRow[]>({ key: ["departments"], path: "/departments", demo: () => snapshot(DEPARTMENTS) });

export const useDoctors = () => useHmsQuery<DoctorRow[]>({ key: ["doctors"], path: "/doctors", demo: () => snapshot(DOCTORS) });

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export const usePatients = () =>
  useHmsQuery<PatientRow[]>({ key: ["patients"], path: "/patients", demo: () => snapshot(demoDb().patients) });

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  gender: PatientRow["gender"];
  dateOfBirth: string;
  phone: string;
  bloodGroup?: PatientRow["bloodGroup"];
  allergies: string[];
}

export function useRegisterPatient() {
  return useHmsMutation<RegisterPatientInput, PatientRow>({
    live: (v) => authFetch("/patients", json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      const digits = v.phone.replace(/\D/g, "").slice(-10);
      if (db.patients.some((p) => p.phone.replace(/\D/g, "").slice(-10) === digits)) {
        throw new Error("A patient with this phone number is already registered.");
      }
      const n = db.patients.length + 1;
      const row: PatientRow = {
        id: nextId("pat"),
        mrn: `MC-${100100 + n + 50}`,
        name: `${v.firstName} ${v.lastName}`,
        gender: v.gender,
        dateOfBirth: v.dateOfBirth,
        phone: v.phone,
        bloodGroup: v.bloodGroup,
        allergies: v.allergies,
        createdAt: new Date().toISOString(),
      };
      db.patients.unshift(row);
      return snapshot(row);
    },
    invalidate: ["patients"],
    success: (p) => `${p.name} registered (${p.mrn})`,
  });
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

export type AppointmentScope = "today" | "doctor-today" | "doctor-upcoming" | "mine" | "all";

const appointmentPath: Record<AppointmentScope, string> = {
  today: "/appointments?date=today",
  "doctor-today": "/appointments?doctorId=me&date=today",
  "doctor-upcoming": "/appointments?doctorId=me&from=tomorrow",
  mine: "/me/appointments",
  all: "/appointments",
};

export function useAppointments(scope: AppointmentScope) {
  return useHmsQuery<AppointmentRow[]>({
    key: ["appointments", scope],
    path: appointmentPath[scope],
    demo: () => {
      const all = demoDb().appointments;
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const rows =
        scope === "today"
          ? all.filter((a) => isToday(a.startsAt))
          : scope === "doctor-today"
            ? all.filter((a) => a.doctorId === DEMO_DOCTOR_ID && isToday(a.startsAt))
            : scope === "doctor-upcoming"
              ? all.filter((a) => a.doctorId === DEMO_DOCTOR_ID && new Date(a.startsAt) >= tomorrow)
              : scope === "mine"
                ? all.filter((a) => a.patientId === DEMO_PATIENT_ID)
                : all;
      return snapshot([...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    },
  });
}

export function useUpdateAppointmentStatus() {
  return useHmsMutation<{ id: string; status: AppointmentStatus }, AppointmentRow>({
    live: ({ id, status }) => authFetch(`/appointments/${id}/status`, json("PATCH", { status })),
    demo: ({ id, status }) => {
      const a = demoDb().appointments.find((x) => x.id === id);
      if (!a) throw new Error("Appointment not found");
      if (!canTransition(a.status, status)) throw new Error(`Can't change status from ${a.status} to ${status}`);
      a.status = status;
      if (status === "IN_PROGRESS") a.checkedInAt ??= new Date().toISOString();
      return snapshot(a);
    },
    invalidate: ["appointments", "record"],
    success: (a) => `${a.patientName}: ${a.status.replace("_", " ").toLowerCase()}`,
  });
}

/** Front-desk check-in: marks arrival; the doctor then starts the consultation. */
export function useCheckIn() {
  return useHmsMutation<{ id: string }, AppointmentRow>({
    live: ({ id }) => authFetch(`/appointments/${id}/check-in`, json("POST")),
    demo: ({ id }) => {
      const a = demoDb().appointments.find((x) => x.id === id);
      if (!a) throw new Error("Appointment not found");
      if (a.status !== "CONFIRMED") throw new Error("Only confirmed appointments can be checked in");
      if (a.checkedInAt) throw new Error("Already checked in");
      a.checkedInAt = new Date().toISOString();
      return snapshot(a);
    },
    invalidate: ["appointments", "record"],
    success: (a) => `${a.patientName} checked in`,
  });
}

export interface BookAppointmentInput {
  patientId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  emergency: boolean;
}

export function useBookAppointment() {
  return useHmsMutation<BookAppointmentInput, AppointmentRow>({
    live: (v) => authFetch("/appointments", json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      if (hasSlotConflict(db.appointments, v.doctorId, v.startsAt, v.endsAt)) {
        throw new Error("That slot was just booked. Please choose another time.");
      }
      const patient = db.patients.find((p) => p.id === v.patientId);
      const doctor = DOCTORS.find((d) => d.id === v.doctorId);
      if (!patient || !doctor) throw new Error("Patient or doctor not found");
      const row: AppointmentRow = {
        id: nextId("apt"),
        patientId: patient.id,
        patientName: patient.name,
        patientMrn: patient.mrn,
        doctorId: doctor.id,
        doctorName: doctor.name,
        department: doctor.department,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
        status: v.emergency ? "CONFIRMED" : "PENDING",
        reason: v.reason,
        emergency: v.emergency,
      };
      db.appointments.push(row);
      return snapshot(row);
    },
    invalidate: ["appointments", "record"],
    success: (a) => `Appointment booked with ${a.doctorName}`,
  });
}

export interface DoctorAvailability {
  /** 0 = Sunday â€¦ 6 = Saturday */
  weekdays: number[];
  windows: { start: string; end: string }[];
  slotMinutes: number;
}

/** Configured working hours for a doctor (GET /doctors/:id/availability). */
export function useDoctorAvailability(doctorId: string | undefined) {
  return useHmsQuery<DoctorAvailability>({
    key: ["availability", doctorId],
    path: `/doctors/${doctorId}/availability`,
    demo: () =>
      doctorId === "doc-6"
        ? { weekdays: [0, 1, 2, 3, 4, 5, 6], windows: [{ start: "08:00", end: "20:00" }], slotMinutes: 20 }
        : { weekdays: [1, 2, 3, 4, 5, 6], windows: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }], slotMinutes: 15 },
  });
}

/** Appointments for one doctor (any date): used to compute free slots. */
export function useDoctorBookings(doctorId: string | undefined) {
  return useHmsQuery<AppointmentRow[]>({
    key: ["appointments", "doctor", doctorId],
    path: `/doctors/${doctorId}/appointments`,
    demo: () => snapshot(demoDb().appointments.filter((a) => a.doctorId === doctorId)),
  });
}

/* ------------------------------------------------------------------ */
/* Medical records (append-only)                                       */
/* ------------------------------------------------------------------ */

export interface PatientRecord {
  patient: PatientRow;
  vitals: VitalRow[];
  diagnoses: DiagnosisRow[];
  notes: EncounterNote[];
  prescriptions: PrescriptionRow[];
  labOrders: LabOrderRow[];
  appointments: AppointmentRow[];
  vaccinations: { name: string; dose: string; date: string }[];
  familyHistory: string[];
}

function buildRecord(patientId: string, patientView: boolean): PatientRecord {
  const db = demoDb();
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) throw new Error("Patient not found");
  const byDate = <T,>(rows: T[], get: (r: T) => string) => [...rows].sort((a, b) => get(b).localeCompare(get(a)));
  return snapshot({
    patient,
    vitals: byDate(db.vitals[patientId] ?? [], (v) => v.recordedAt),
    diagnoses: byDate(db.diagnoses[patientId] ?? [], (d) => d.recordedAt),
    notes: byDate(db.notes[patientId] ?? [], (n) => n.createdAt),
    prescriptions: byDate(db.prescriptions.filter((r) => r.patientId === patientId), (r) => r.issuedAt),
    // Patients only ever see approved lab results.
    labOrders: byDate(
      db.labOrders.filter((o) => o.patientId === patientId && (!patientView || isPatientVisible(o.status))),
      (o) => o.orderedAt,
    ),
    appointments: byDate(db.appointments.filter((a) => a.patientId === patientId), (a) => a.startsAt),
    vaccinations: db.vaccinations[patientId] ?? [],
    familyHistory: db.familyHistory[patientId] ?? [],
  });
}

export const usePatientRecord = (patientId: string) =>
  useHmsQuery<PatientRecord>({ key: ["record", patientId], path: `/patients/${patientId}/record`, demo: () => buildRecord(patientId, false) });

export const useMyRecord = () =>
  useHmsQuery<PatientRecord>({ key: ["record", "me"], path: "/me/record", demo: () => buildRecord(DEMO_PATIENT_ID, true) });

export type VitalsInput = Omit<VitalRow, "id" | "recordedAt" | "recordedBy" | "bmi">;

export function useRecordVitals(patientId: string) {
  return useHmsMutation<VitalsInput, VitalRow>({
    live: (v) => authFetch(`/patients/${patientId}/vitals`, json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      const row: VitalRow = { ...v, id: nextId("vit"), recordedAt: new Date().toISOString(), recordedBy: actorName(), bmi: calculateBmi(v.weightKg, v.heightCm) ?? undefined };
      (db.vitals[patientId] ??= []).push(row);
      return snapshot(row);
    },
    invalidate: ["record", "ward"],
    success: "Vitals recorded",
  });
}

export function useAddDiagnosis(patientId: string) {
  return useHmsMutation<{ code?: string; description: string; type: DiagnosisRow["type"] }, DiagnosisRow>({
    live: (v) => authFetch(`/patients/${patientId}/diagnoses`, json("POST", v)),
    demo: (v) => {
      const row: DiagnosisRow = { ...v, id: nextId("dx"), recordedAt: new Date().toISOString(), recordedBy: actorName() };
      (demoDb().diagnoses[patientId] ??= []).push(row);
      return snapshot(row);
    },
    invalidate: ["record"],
    success: "Diagnosis added",
  });
}

/** New note, or a correction that references (never overwrites) an earlier note. */
export function useAddEncounterNote(patientId: string) {
  return useHmsMutation<{ symptoms: string; treatmentPlan: string; amendsId?: string; amendReason?: string }, EncounterNote>({
    live: (v) => authFetch(`/patients/${patientId}/notes`, json("POST", v)),
    demo: (v) => {
      const row: EncounterNote = { ...v, id: nextId("en"), createdAt: new Date().toISOString(), author: actorName() };
      (demoDb().notes[patientId] ??= []).push(row);
      return snapshot(row);
    },
    invalidate: ["record"],
    success: (n) => (n.amendsId ? "Correction saved (original kept in history)" : "Encounter note saved"),
  });
}

/* ------------------------------------------------------------------ */
/* Prescriptions & pharmacy                                            */
/* ------------------------------------------------------------------ */

export function useCreatePrescription(patientId: string) {
  return useHmsMutation<{ items: PrescriptionItemRow[] }, PrescriptionRow>({
    live: (v) => authFetch(`/patients/${patientId}/prescriptions`, json("POST", v)),
    demo: ({ items }) => {
      const db = demoDb();
      const patient = db.patients.find((p) => p.id === patientId)!;
      const row: PrescriptionRow = {
        id: nextId("rx"),
        code: `RX-${db.seq}`,
        patientId,
        patientName: patient.name,
        doctorName: actorName(),
        issuedAt: new Date().toISOString(),
        status: "ISSUED",
        items,
      };
      db.prescriptions.unshift(row);
      return snapshot(row);
    },
    invalidate: ["record", "prescriptions"],
    success: (r) => `Prescription ${r.code} issued and sent to pharmacy`,
  });
}

export const usePrescriptions = () =>
  useHmsQuery<PrescriptionRow[]>({ key: ["prescriptions"], path: "/pharmacy/prescriptions", demo: () => snapshot(demoDb().prescriptions) });

export const useBatches = () =>
  useHmsQuery<MedicineBatchRow[]>({ key: ["batches"], path: "/pharmacy/batches", demo: () => snapshot(demoDb().batches) });

/** Dispense every line of a prescription using FIFO batches (expired stock is never used). */
export function useDispensePrescription() {
  return useHmsMutation<{ id: string }, { code: string; picks: string[] }>({
    live: ({ id }) => authFetch(`/pharmacy/prescriptions/${id}/dispense`, json("POST")),
    demo: ({ id }) => {
      const db = demoDb();
      const rx = db.prescriptions.find((r) => r.id === id);
      if (!rx) throw new Error("Prescription not found");
      if (rx.status === "DISPENSED") throw new Error("Already dispensed");
      // Allocate everything first so a shortage doesn't leave a half-dispensed order.
      const plan = rx.items.map((item) => {
        try {
          return { item, picks: allocateFifo(db.batches, item.medicineId, item.quantity) };
        } catch (e) {
          throw new Error(`${item.medicineName}: ${(e as Error).message}`);
        }
      });
      const picks: string[] = [];
      for (const { item, picks: p } of plan) {
        for (const pick of p) {
          db.batches.find((b) => b.id === pick.batchId)!.quantity -= pick.quantity;
          picks.push(`${item.medicineName} Ã— ${pick.quantity} from ${pick.batchNo}`);
        }
      }
      rx.status = "DISPENSED";
      return { code: rx.code, picks };
    },
    invalidate: ["prescriptions", "batches", "record"],
    success: (r) => `${r.code} dispensed: ${r.picks.join("; ")}`,
  });
}

export function useAddBatch() {
  return useHmsMutation<Omit<MedicineBatchRow, "id">, MedicineBatchRow>({
    live: (v) => authFetch("/pharmacy/batches", json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      if (db.batches.some((b) => b.batchNo === v.batchNo && b.medicineId === v.medicineId)) {
        throw new Error("This batch number already exists for the medicine.");
      }
      const row = { ...v, id: nextId("bat") };
      db.batches.push(row);
      return snapshot(row);
    },
    invalidate: ["batches"],
    success: (b) => `Batch ${b.batchNo} added`,
  });
}

/* ------------------------------------------------------------------ */
/* Laboratory                                                          */
/* ------------------------------------------------------------------ */

export const useLabOrders = () =>
  useHmsQuery<LabOrderRow[]>({ key: ["labOrders"], path: "/lab/orders", demo: () => snapshot(demoDb().labOrders) });

export function useCreateLabOrder(patientId: string) {
  return useHmsMutation<{ testName: string; priority: LabOrderRow["priority"] }, LabOrderRow>({
    live: (v) => authFetch(`/patients/${patientId}/lab-orders`, json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      const patient = db.patients.find((p) => p.id === patientId)!;
      const row: LabOrderRow = {
        id: nextId("lab"),
        code: `LAB-${db.seq}`,
        patientId,
        patientName: patient.name,
        testName: v.testName,
        priority: v.priority,
        orderedBy: actorName(),
        orderedAt: new Date().toISOString(),
        status: "ORDERED",
      };
      db.labOrders.unshift(row);
      return snapshot(row);
    },
    invalidate: ["labOrders", "record"],
    success: (o) => `${o.testName} ordered (${o.code})`,
  });
}

/** Move a lab order one step forward (collect -> process). */
export function useAdvanceLabOrder() {
  return useHmsMutation<{ id: string }, LabOrderRow>({
    live: ({ id }) => authFetch(`/lab/orders/${id}/advance`, json("POST")),
    demo: ({ id }) => {
      const o = demoDb().labOrders.find((x) => x.id === id);
      if (!o) throw new Error("Order not found");
      const next = LAB_NEXT_STATUS[o.status];
      if (!next || next === "RESULT_ENTERED" || next === "APPROVED") throw new Error("Use result entry / approval for this step");
      o.status = next;
      return snapshot(o);
    },
    invalidate: ["labOrders"],
    success: (o) => `${o.code}: ${o.status.replace("_", " ").toLowerCase()}`,
  });
}

export function useEnterLabResults() {
  return useHmsMutation<{ id: string; results: LabResultRow[] }, LabOrderRow>({
    live: ({ id, results }) => authFetch(`/lab/orders/${id}/results`, json("POST", { results })),
    demo: ({ id, results }) => {
      const o = demoDb().labOrders.find((x) => x.id === id);
      if (!o) throw new Error("Order not found");
      if (o.status !== "PROCESSING" && o.status !== "RESULT_ENTERED") throw new Error("Results can only be entered while processing");
      o.results = results;
      o.status = "RESULT_ENTERED";
      return snapshot(o);
    },
    invalidate: ["labOrders", "record"],
    success: (o) => `Results saved for ${o.code}. Awaiting approval.`,
  });
}

export function useApproveLabOrder() {
  return useHmsMutation<{ id: string }, LabOrderRow>({
    live: ({ id }) => authFetch(`/lab/orders/${id}/approve`, json("POST")),
    demo: ({ id }) => {
      const o = demoDb().labOrders.find((x) => x.id === id);
      if (!o) throw new Error("Order not found");
      if (o.status !== "RESULT_ENTERED" || !o.results?.length) throw new Error("Enter results before approving");
      o.status = "APPROVED";
      o.approvedBy = actorName();
      return snapshot(o);
    },
    invalidate: ["labOrders", "record"],
    success: (o) => `${o.code} approved. The patient can now see the report.`,
  });
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export const useInvoices = (scope: "all" | "mine" = "all") =>
  useHmsQuery<InvoiceRow[]>({
    key: ["invoices", scope],
    path: scope === "mine" ? "/me/invoices" : "/billing/invoices",
    demo: () => {
      const all = demoDb().invoices;
      return snapshot((scope === "mine" ? all.filter((i) => i.patientId === DEMO_PATIENT_ID) : all).toSorted((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
    },
  });

export function useCreateInvoice() {
  return useHmsMutation<{ patientId: string; items: InvoiceItemRow[] }, InvoiceRow>({
    live: (v) => authFetch("/billing/invoices", json("POST", v)),
    demo: ({ patientId, items }) => {
      const db = demoDb();
      const patient = db.patients.find((p) => p.id === patientId);
      if (!patient) throw new Error("Patient not found");
      if (!items.length) throw new Error("Add at least one charge");
      const now = new Date();
      const row: InvoiceRow = {
        id: nextId("inv"),
        number: `INV-${now.getFullYear()}-${String(db.seq).slice(-4)}`,
        patientId,
        patientName: patient.name,
        issuedAt: now.toISOString(),
        dueAt: new Date(now.getTime() + 15 * 86_400_000).toISOString(),
        status: "ISSUED",
        items,
        ...invoiceTotals(items),
        paid: 0,
      };
      db.invoices.unshift(row);
      return snapshot(row);
    },
    invalidate: ["invoices"],
    success: (i) => `Invoice ${i.number} issued`,
  });
}

/**
 * Cash/card/UPI payments recorded at the counter.
 * Online payments (Razorpay/Stripe) are confirmed only by the API after it
 * verifies the gateway signature/webhook (Stage 5) â€” never by the browser.
 */
export function useRecordPayment() {
  return useHmsMutation<{ invoiceId: string; amount: number; method: Exclude<PaymentMethod, "RAZORPAY" | "STRIPE"> }, InvoiceRow>({
    live: ({ invoiceId, ...v }) => authFetch(`/billing/invoices/${invoiceId}/payments`, json("POST", v)),
    demo: ({ invoiceId, amount, method }) => {
      const inv = demoDb().invoices.find((i) => i.id === invoiceId);
      if (!inv) throw new Error("Invoice not found");
      if (inv.status === "VOID" || inv.status === "PAID") throw new Error("This invoice can't take payments");
      const due = Math.round((inv.total - inv.paid) * 100) / 100;
      if (amount <= 0 || amount > due) throw new Error(`Amount must be between â‚¹1 and â‚¹${due}`);
      inv.paid = Math.round((inv.paid + amount) * 100) / 100;
      inv.status = inv.paid >= inv.total ? "PAID" : "PARTIALLY_PAID";
      inv.lastPaymentMethod = method;
      return snapshot(inv);
    },
    invalidate: ["invoices"],
    success: (i) => `Payment recorded for ${i.number}`,
  });
}

export const useClaims = () => useHmsQuery<ClaimRow[]>({ key: ["claims"], path: "/billing/claims", demo: () => snapshot(demoDb().claims) });

export function useUpdateClaim() {
  return useHmsMutation<{ id: string; status: ClaimRow["status"] }, ClaimRow>({
    live: ({ id, status }) => authFetch(`/billing/claims/${id}`, json("PATCH", { status })),
    demo: ({ id, status }) => {
      const c = demoDb().claims.find((x) => x.id === id);
      if (!c) throw new Error("Claim not found");
      c.status = status;
      if (status === "SUBMITTED") c.submittedAt = new Date().toISOString();
      return snapshot(c);
    },
    invalidate: ["claims"],
    success: (c) => `${c.claimNo}: ${c.status.replace("_", " ").toLowerCase()}`,
  });
}

/* ------------------------------------------------------------------ */
/* Hospital administration                                             */
/* ------------------------------------------------------------------ */

export const useStaff = () => useHmsQuery<StaffRow[]>({ key: ["staff"], path: "/staff", demo: () => snapshot(demoDb().staff) });

export function useCreateStaff() {
  return useHmsMutation<Omit<StaffRow, "id" | "active" | "joinedAt">, StaffRow>({
    live: (v) => authFetch("/staff", json("POST", v)),
    demo: (v) => {
      const db = demoDb();
      if (db.staff.some((s) => s.email.toLowerCase() === v.email.toLowerCase())) throw new Error("A staff member with this email already exists.");
      const row: StaffRow = { ...v, id: nextId("stf"), active: true, joinedAt: new Date().toISOString() };
      db.staff.unshift(row);
      return snapshot(row);
    },
    invalidate: ["staff"],
    success: (s) => `${s.name} added. An invitation email is sent in live mode.`,
  });
}

export function useSetStaffActive() {
  return useHmsMutation<{ id: string; active: boolean }, StaffRow>({
    live: ({ id, active }) => authFetch(`/staff/${id}`, json("PATCH", { active })),
    demo: ({ id, active }) => {
      const s = demoDb().staff.find((x) => x.id === id);
      if (!s) throw new Error("Staff member not found");
      s.active = active;
      return snapshot(s);
    },
    invalidate: ["staff"],
    success: (s) => `${s.name} ${s.active ? "reactivated" : "deactivated"}`,
  });
}

export const useBeds = () => useHmsQuery<BedRow[]>({ key: ["beds"], path: "/beds", demo: () => snapshot(demoDb().beds) });

export function useSetBedStatus() {
  return useHmsMutation<{ id: string; status: BedRow["status"] }, BedRow>({
    live: ({ id, status }) => authFetch(`/beds/${id}`, json("PATCH", { status })),
    demo: ({ id, status }) => {
      const b = demoDb().beds.find((x) => x.id === id);
      if (!b) throw new Error("Bed not found");
      if (b.status === "OCCUPIED" && status !== "CLEANING") throw new Error("Discharge the patient first (bed goes to cleaning).");
      if (status === "CLEANING") {
        b.patientName = undefined;
        b.patientId = undefined;
      }
      b.status = status;
      return snapshot(b);
    },
    invalidate: ["beds", "ward"],
    success: (b) => `Bed ${b.label}: ${b.status.toLowerCase()}`,
  });
}

/* ------------------------------------------------------------------ */
/* Nursing                                                             */
/* ------------------------------------------------------------------ */

export interface WardPatient {
  bed: BedRow;
  patient: PatientRow;
  lastVitals?: VitalRow;
}

export const useWardPatients = () =>
  useHmsQuery<WardPatient[]>({
    key: ["ward", "assigned"],
    path: "/nursing/assigned-patients",
    demo: () => {
      const db = demoDb();
      return snapshot(
        db.beds
          .filter((b) => b.patientId)
          .map((bed) => {
            const vit = db.vitals[bed.patientId!] ?? [];
            return { bed, patient: db.patients.find((p) => p.id === bed.patientId)!, lastVitals: vit[vit.length - 1] };
          }),
      );
    },
  });

export const useMedicationNotes = () =>
  useHmsQuery<MedicationNote[]>({ key: ["medNotes"], path: "/nursing/medication-notes", demo: () => snapshot(demoDb().medNotes) });

export function useAddMedicationNote() {
  return useHmsMutation<Omit<MedicationNote, "id" | "givenAt" | "givenBy"> & { patientId: string }, MedicationNote>({
    live: (v) => authFetch("/nursing/medication-notes", json("POST", v)),
    demo: (v) => {
      const row: MedicationNote = { ...v, id: nextId("mn"), givenAt: new Date().toISOString(), givenBy: actorName() };
      demoDb().medNotes.unshift(row);
      return snapshot(row);
    },
    invalidate: ["medNotes"],
    success: "Medication administration recorded",
  });
}

/* ------------------------------------------------------------------ */
/* Platform (super admin)                                              */
/* ------------------------------------------------------------------ */

export const useHospitals = () =>
  useHmsQuery<HospitalRow[]>({ key: ["hospitals"], path: "/hospitals", demo: () => snapshot(demoDb().hospitals) });

export function useSetHospitalStatus() {
  return useHmsMutation<{ id: string; status: HospitalRow["status"] }, HospitalRow>({
    live: ({ id, status }) => authFetch(`/hospitals/${id}/status`, json("PATCH", { status })),
    demo: ({ id, status }) => {
      const h = demoDb().hospitals.find((x) => x.id === id);
      if (!h) throw new Error("Hospital not found");
      h.status = status;
      demoDb().audit.unshift({
        id: nextId("a"),
        at: new Date().toISOString(),
        actor: actorName(),
        actorRole: "SUPER_ADMIN",
        action: status === "ACTIVE" ? "HOSPITAL_VERIFY" : "HOSPITAL_SUSPEND",
        entity: h.name,
        ip: "demo",
      });
      return snapshot(h);
    },
    invalidate: ["hospitals", "audit"],
    success: (h) => `${h.name} is now ${h.status === "ACTIVE" ? "active" : "suspended"}`,
  });
}

export function useChangePlan() {
  return useHmsMutation<{ id: string; plan: HospitalRow["plan"] }, HospitalRow>({
    live: ({ id, plan }) => authFetch(`/hospitals/${id}/subscription`, json("PATCH", { plan })),
    demo: ({ id, plan }) => {
      const h = demoDb().hospitals.find((x) => x.id === id);
      if (!h) throw new Error("Hospital not found");
      h.plan = plan;
      return snapshot(h);
    },
    invalidate: ["hospitals"],
    success: (h) => `${h.name} moved to the ${h.plan.toLowerCase()} plan`,
  });
}

export const useAuditLogs = () =>
  useHmsQuery<AuditLogRow[]>({ key: ["audit"], path: "/audit-logs", demo: () => snapshot(demoDb().audit) });

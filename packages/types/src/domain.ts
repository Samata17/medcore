/**
 * Row shapes returned by list endpoints. The API maps Prisma models to these,
 * so the frontend never depends on database internals.
 */
import type { AppointmentStatus, InvoiceStatus, LabOrderStatus, PaymentMethod, Role } from "./index";

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface DepartmentRow {
  id: string;
  name: string;
  headDoctor?: string;
  doctors: number;
  patientsToday: number;
}

export interface DoctorRow {
  id: string;
  name: string;
  specialization: string;
  departmentId: string;
  department: string;
  experienceYears: number;
  consultationFee: number;
  available: boolean;
}

export interface PatientRow {
  id: string;
  mrn: string; // medical record number
  name: string;
  gender: Gender;
  dateOfBirth: string;
  phone: string;
  bloodGroup?: BloodGroup;
  allergies: string[];
  lastVisit?: string;
  createdAt: string;
}

export interface AppointmentRow {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  doctorId: string;
  doctorName: string;
  department: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason: string;
  emergency: boolean;
  checkedInAt?: string;
}

export interface VitalRow {
  id: string;
  recordedAt: string;
  recordedBy: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  temperatureC?: number;
  spo2?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
}

export interface DiagnosisRow {
  id: string;
  code?: string; // ICD-10 where available
  description: string;
  type: "PROVISIONAL" | "FINAL";
  recordedAt: string;
  recordedBy: string;
}

/** Append-only clinical note; corrections reference the entry they amend. */
export interface EncounterNote {
  id: string;
  createdAt: string;
  author: string;
  symptoms: string;
  treatmentPlan: string;
  amendsId?: string;
  amendReason?: string;
}

export interface PrescriptionItemRow {
  medicineId: string;
  medicineName: string;
  dosage: string; // "500 mg"
  frequency: string; // "1-0-1"
  durationDays: number;
  instructions?: string;
  quantity: number;
}

export interface PrescriptionRow {
  id: string;
  code: string; // RX-1043
  patientId: string;
  patientName: string;
  doctorName: string;
  issuedAt: string;
  status: "ISSUED" | "PARTIALLY_DISPENSED" | "DISPENSED" | "CANCELLED";
  items: PrescriptionItemRow[];
}

export interface LabResultRow {
  parameter: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
}

export interface LabOrderRow {
  id: string;
  code: string; // LAB-2031
  patientId: string;
  patientName: string;
  testName: string;
  orderedBy: string;
  orderedAt: string;
  priority: "ROUTINE" | "URGENT";
  status: LabOrderStatus;
  results?: LabResultRow[];
  approvedBy?: string;
  /** Uploaded report files (PDF/PNG/JPEG) */
  attachments?: { id: string; fileName: string }[];
}

export interface MedicineBatchRow {
  id: string;
  medicineId: string;
  medicineName: string;
  category: string;
  batchNo: string;
  manufacturedOn: string;
  expiresOn: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  mrp: number;
}

export interface InvoiceItemRow {
  description: string;
  category: "CONSULTATION" | "LAB" | "PHARMACY" | "ROOM" | "PROCEDURE";
  quantity: number;
  unitPrice: number;
  taxRate: number; // percent
}

export interface InvoiceRow {
  id: string;
  number: string; // INV-2024-0318
  patientId: string;
  patientName: string;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  items: InvoiceItemRow[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  lastPaymentMethod?: PaymentMethod;
}

export interface ClaimRow {
  id: string;
  claimNo: string;
  invoiceNumber: string;
  patientName: string;
  insurer: string;
  amount: number;
  submittedAt: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SETTLED";
}

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  active: boolean;
  joinedAt: string;
}

export interface BedRow {
  id: string;
  ward: string;
  label: string; // "B-12"
  type: "GENERAL" | "ICU" | "PRIVATE" | "PEDIATRIC";
  status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "RESERVED";
  patientName?: string;
  patientId?: string;
}

export interface HospitalRow {
  id: string;
  name: string;
  city: string;
  state: string;
  beds: number;
  doctors: number;
  patients: number;
  plan: "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  onboardedAt: string;
  monthlyRevenue: number;
}

export interface AuditLogRow {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: string; // "LOGIN", "PATIENT_VIEW", ...
  entity: string;
  hospital?: string;
  ip: string;
}

export interface MedicationNote {
  id: string;
  patientId?: string;
  patientName: string;
  medicine: string;
  dose: string;
  givenAt: string;
  givenBy: string;
  note?: string;
}

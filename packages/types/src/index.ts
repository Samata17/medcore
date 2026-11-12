/**
 * Shared types for MedCore HMS.
 * These mirror the Prisma enums (Stage 4) so the frontend and backend
 * always agree on role names and status values.
 */

export * from "./domain";
export * from "./rules";

export const ROLES = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "LAB_TECHNICIAN",
  "PHARMACIST",
  "ACCOUNTANT",
  "PATIENT",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  LAB_TECHNICIAN: "Lab Technician",
  PHARMACIST: "Pharmacist",
  ACCOUNTANT: "Accountant",
  PATIENT: "Patient",
};

/** Where each role lands after login. */
export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/dashboard/super-admin",
  HOSPITAL_ADMIN: "/dashboard/hospital-admin",
  DOCTOR: "/dashboard/doctor",
  NURSE: "/dashboard/nurse",
  RECEPTIONIST: "/dashboard/reception",
  LAB_TECHNICIAN: "/dashboard/lab",
  PHARMACIST: "/dashboard/pharmacy",
  ACCOUNTANT: "/dashboard/accounts",
  PATIENT: "/dashboard/patient",
};

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const LAB_ORDER_STATUSES = [
  "ORDERED",
  "SAMPLE_COLLECTED",
  "PROCESSING",
  "RESULT_ENTERED",
  "APPROVED",
  "CANCELLED",
] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "VOID",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "RAZORPAY", "STRIPE", "INSURANCE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Consistent response envelope returned by every API endpoint. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    statusCode: number;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const NOTIFICATION_TYPES = [
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_REMINDER",
  "LAB_REPORT_APPROVED",
  "PRESCRIPTION_READY",
  "INVOICE_ISSUED",
  "PAYMENT_RECEIVED",
  "LOW_STOCK",
  "EMERGENCY_APPOINTMENT",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string; // ISO date
  read: boolean;
  href?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  hospitalId: string | null;
  hospitalName?: string | null;
  emailVerified: boolean;
}

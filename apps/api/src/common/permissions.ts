import type { Role } from "@prisma/client";

/**
 * Permission catalogue. Each endpoint declares the permission it needs with
 * @RequirePermissions(); PermissionsGuard checks it against the RolePermission
 * table (seeded from ROLE_PERMISSIONS below).
 */
export const P = {
  PLATFORM_MANAGE: "platform:manage",
  ANALYTICS_PLATFORM: "analytics:platform",
  HOSPITAL_MANAGE: "hospital:manage",
  STAFF_MANAGE: "staff:manage",
  AUDIT_READ: "audit:read",
  DIRECTORY_READ: "directory:read", // departments & doctors
  PATIENTS_READ: "patients:read",
  PATIENTS_WRITE: "patients:write",
  APPOINTMENTS_READ: "appointments:read",
  APPOINTMENTS_WRITE: "appointments:write",
  RECORDS_READ: "records:read",
  RECORDS_WRITE: "records:write",
  VITALS_WRITE: "vitals:write",
  PRESCRIPTIONS_WRITE: "prescriptions:write",
  LAB_ORDER: "lab:order",
  LAB_PROCESS: "lab:process",
  PHARMACY_MANAGE: "pharmacy:manage",
  BILLING_MANAGE: "billing:manage",
  CLAIMS_MANAGE: "claims:manage",
  BEDS_MANAGE: "beds:manage",
  NURSING: "nursing:write",
  ANALYTICS_HOSPITAL: "analytics:hospital",
  SELF_PORTAL: "self:portal", // patient's own data only
} as const;

export type Permission = (typeof P)[keyof typeof P];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [P.PLATFORM_MANAGE, P.ANALYTICS_PLATFORM, P.AUDIT_READ],
  HOSPITAL_ADMIN: [
    P.HOSPITAL_MANAGE, P.STAFF_MANAGE, P.AUDIT_READ, P.DIRECTORY_READ, P.PATIENTS_READ, P.PATIENTS_WRITE,
    P.APPOINTMENTS_READ, P.BEDS_MANAGE, P.ANALYTICS_HOSPITAL,
  ],
  DOCTOR: [
    P.DIRECTORY_READ, P.PATIENTS_READ, P.APPOINTMENTS_READ, P.APPOINTMENTS_WRITE, P.RECORDS_READ, P.RECORDS_WRITE,
    P.VITALS_WRITE, P.PRESCRIPTIONS_WRITE, P.LAB_ORDER,
  ],
  NURSE: [P.DIRECTORY_READ, P.PATIENTS_READ, P.RECORDS_READ, P.VITALS_WRITE, P.BEDS_MANAGE, P.NURSING],
  RECEPTIONIST: [P.DIRECTORY_READ, P.PATIENTS_READ, P.PATIENTS_WRITE, P.APPOINTMENTS_READ, P.APPOINTMENTS_WRITE, P.BILLING_MANAGE],
  LAB_TECHNICIAN: [P.DIRECTORY_READ, P.PATIENTS_READ, P.LAB_PROCESS],
  PHARMACIST: [P.DIRECTORY_READ, P.PATIENTS_READ, P.PHARMACY_MANAGE],
  ACCOUNTANT: [P.DIRECTORY_READ, P.PATIENTS_READ, P.BILLING_MANAGE, P.CLAIMS_MANAGE, P.ANALYTICS_HOSPITAL],
  PATIENT: [P.DIRECTORY_READ, P.SELF_PORTAL],
};

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { RequestUser } from "./auth-types";

/**
 * Tenant isolation helpers. Every query on hospital-owned data must go
 * through one of these so a user can never read another hospital's rows.
 */

/** The hospital the user works in. Platform admins must use platform endpoints instead. */
export function hospitalOf(user: RequestUser): string {
  if (!user.hospitalId) throw new ForbiddenException("This action requires a hospital account");
  return user.hospitalId;
}

/** Throws 404 (not 403) when a row belongs to another hospital, so IDs can't be probed. */
export function assertSameHospital(user: RequestUser, rowHospitalId: string | null | undefined) {
  if (!rowHospitalId || rowHospitalId !== user.hospitalId) throw new NotFoundException("Record not found");
}

/** Patients may only touch their own patient record. */
export function assertOwnPatient(user: RequestUser, patientId: string) {
  if (user.role === "PATIENT" && user.patientId !== patientId) throw new NotFoundException("Record not found");
}

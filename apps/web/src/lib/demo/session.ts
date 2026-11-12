import { ROLES, type AuthUser, type Role } from "@medcore/types";

/**
 * SAMPLE DATA — fictional demo accounts, one per role.
 * Used only in demo mode, which is always labeled in the UI.
 */
export const DEMO_HOSPITAL = { id: "demo-hosp-1", name: "Sunrise General Hospital (Sample)" };

export const DEMO_USERS: Record<Role, AuthUser> = {
  SUPER_ADMIN: { id: "demo-u-1", email: "superadmin@demo.medcore", firstName: "Ananya", lastName: "Rao", role: "SUPER_ADMIN", hospitalId: null, emailVerified: true },
  HOSPITAL_ADMIN: { id: "demo-u-2", email: "admin@demo.medcore", firstName: "Rahul", lastName: "Mehta", role: "HOSPITAL_ADMIN", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  DOCTOR: { id: "demo-u-3", email: "doctor@demo.medcore", firstName: "Kavita", lastName: "Sharma", role: "DOCTOR", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  NURSE: { id: "demo-u-4", email: "nurse@demo.medcore", firstName: "Meera", lastName: "Pillai", role: "NURSE", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  RECEPTIONIST: { id: "demo-u-5", email: "reception@demo.medcore", firstName: "Arjun", lastName: "Nair", role: "RECEPTIONIST", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  LAB_TECHNICIAN: { id: "demo-u-6", email: "lab@demo.medcore", firstName: "Sneha", lastName: "Joshi", role: "LAB_TECHNICIAN", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  PHARMACIST: { id: "demo-u-7", email: "pharmacy@demo.medcore", firstName: "Vikram", lastName: "Desai", role: "PHARMACIST", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  ACCOUNTANT: { id: "demo-u-8", email: "accounts@demo.medcore", firstName: "Pooja", lastName: "Iyer", role: "ACCOUNTANT", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
  PATIENT: { id: "demo-u-9", email: "patient@demo.medcore", firstName: "Rohan", lastName: "Kulkarni", role: "PATIENT", hospitalId: DEMO_HOSPITAL.id, emailVerified: true },
};

const KEY = "medcore-demo-role";

/** Demo role is kept in sessionStorage so it ends when the tab closes. */
export function saveDemoRole(role: Role) {
  try {
    sessionStorage.setItem(KEY, role);
  } catch {
    /* storage blocked: demo lasts until reload */
  }
}

export function loadDemoRole(): Role | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v && (ROLES as readonly string[]).includes(v) ? (v as Role) : null;
  } catch {
    return null;
  }
}

export function clearDemoRole() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

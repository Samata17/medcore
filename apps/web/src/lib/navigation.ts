import {
  BedDouble,
  Bell,
  Building2,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  FileHeart,
  FlaskConical,
  LayoutDashboard,
  Package,
  Pill,
  Receipt,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ROLE_HOME, type Role } from "@medcore/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}
export interface NavSection {
  title?: string;
  items: NavItem[];
}

const home = (role: Role, title = "Overview"): NavItem => ({ title, href: ROLE_HOME[role], icon: LayoutDashboard });

/**
 * Sidebar navigation per role.
 * This only controls what is SHOWN. The API enforces the same rules on every
 * request, so hiding a link is never the only protection.
 */
export const NAVIGATION: Record<Role, NavSection[]> = {
  SUPER_ADMIN: [
    {
      items: [
        home("SUPER_ADMIN"),
        { title: "Hospitals", href: "/dashboard/super-admin/hospitals", icon: Building2 },
        { title: "Subscriptions", href: "/dashboard/super-admin/subscriptions", icon: CreditCard },
        { title: "Activity logs", href: "/dashboard/super-admin/activity", icon: ScrollText },
      ],
    },
  ],
  HOSPITAL_ADMIN: [
    {
      items: [
        home("HOSPITAL_ADMIN"),
        { title: "Staff", href: "/dashboard/hospital-admin/staff", icon: UserCog },
        { title: "Departments & beds", href: "/dashboard/hospital-admin/departments", icon: BedDouble },
      ],
    },
  ],
  DOCTOR: [
    {
      items: [
        home("DOCTOR", "My day"),
        { title: "Patients", href: "/dashboard/doctor/patients", icon: Users },
      ],
    },
  ],
  NURSE: [
    {
      items: [
        home("NURSE"),
        { title: "Ward", href: "/dashboard/nurse/ward", icon: BedDouble },
      ],
    },
  ],
  RECEPTIONIST: [
    {
      items: [
        home("RECEPTIONIST", "Today's desk"),
        { title: "Patients", href: "/dashboard/reception/patients", icon: Users },
        { title: "Book appointment", href: "/dashboard/reception/book", icon: CalendarPlus },
        { title: "Billing", href: "/dashboard/reception/billing", icon: Receipt },
      ],
    },
  ],
  LAB_TECHNICIAN: [
    {
      items: [
        home("LAB_TECHNICIAN"),
        { title: "Test orders", href: "/dashboard/lab/orders", icon: FlaskConical },
      ],
    },
  ],
  PHARMACIST: [
    {
      items: [
        home("PHARMACIST"),
        { title: "Inventory", href: "/dashboard/pharmacy/inventory", icon: Package },
        { title: "Prescriptions", href: "/dashboard/pharmacy/prescriptions", icon: Pill },
      ],
    },
  ],
  ACCOUNTANT: [
    {
      items: [
        home("ACCOUNTANT"),
        { title: "Invoices", href: "/dashboard/accounts/invoices", icon: Receipt },
        { title: "Insurance claims", href: "/dashboard/accounts/claims", icon: ShieldCheck },
      ],
    },
  ],
  PATIENT: [
    {
      items: [
        home("PATIENT", "My health"),
        { title: "Appointments", href: "/dashboard/patient/appointments", icon: CalendarCheck },
        { title: "Medical records", href: "/dashboard/patient/records", icon: FileHeart },
        { title: "Billing", href: "/dashboard/patient/billing", icon: Receipt },
      ],
    },
  ],
};

/** Pages every signed-in user can open. */
export const SHARED_NAV: NavSection = {
  title: "Account",
  items: [
    { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
    { title: "Profile", href: "/dashboard/profile", icon: ClipboardList },
  ],
};

const SHARED_PREFIXES = ["/dashboard/notifications", "/dashboard/profile"];

/** Client-side route guard: may this role open this dashboard path? */
export function canAccessPath(role: Role, pathname: string) {
  if (pathname === "/dashboard") return true;
  if (SHARED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  const base = ROLE_HOME[role];
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Roles whose top-bar search looks up patients, and where results open. */
export const PATIENT_SEARCH_HREF: Partial<Record<Role, string>> = {
  DOCTOR: "/dashboard/doctor/patients",
  RECEPTIONIST: "/dashboard/reception/patients",
};

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calculator,
  ClipboardPlus,
  FlaskConical,
  Globe,
  HeartPulse,
  Pill,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ROLE_HOME, ROLE_LABELS, ROLES, type Role } from "@medcore/types";
import { DEMO_USERS, saveDemoRole } from "@/lib/demo/session";
import { useAuthStore } from "@/stores/auth-store";

const ICONS: Record<Role, LucideIcon> = {
  SUPER_ADMIN: Globe,
  HOSPITAL_ADMIN: Building2,
  DOCTOR: Stethoscope,
  NURSE: HeartPulse,
  RECEPTIONIST: ClipboardPlus,
  LAB_TECHNICIAN: FlaskConical,
  PHARMACIST: Pill,
  ACCOUNTANT: Calculator,
  PATIENT: UserRound,
};

export function DemoRolePicker() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setDemoSession = useAuthStore((s) => s.setDemoSession);

  function start(role: Role) {
    saveDemoRole(role);
    queryClient.clear();
    setDemoSession(DEMO_USERS[role]);
    router.push(ROLE_HOME[role]);
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ROLES.map((role) => {
          const Icon = ICONS[role];
          return (
            <button
              key={role}
              type="button"
              onClick={() => start(role)}
              className="flex flex-col items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

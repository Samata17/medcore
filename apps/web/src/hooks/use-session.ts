"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/lib/auth-api";
import { DEMO_HOSPITAL, clearDemoRole } from "@/lib/demo/session";

/** Signed-in user (dashboard pages render only after the session gate confirms one). */
export function useCurrentUser() {
  const user = useAuthStore((s) => s.user);
  if (!user) throw new Error("useCurrentUser must be used inside the dashboard session gate");
  return user;
}

/** Name of the signed-in user's hospital (the fictional sample hospital in demo mode). */
export function useHospitalName() {
  const user = useAuthStore((s) => s.user);
  const mode = useAuthStore((s) => s.mode);
  if (mode === "demo") return DEMO_HOSPITAL.name.replace(" (Sample)", "");
  return user?.hospitalName ?? "MedCore HMS";
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mode = useAuthStore((s) => s.mode);
  const clear = useAuthStore((s) => s.clear);

  return async function logout() {
    if (mode === "live") {
      try {
        await authApi.logout();
      } catch {
        toast.warning("Signed out on this device. The server could not be reached to revoke the session.");
      }
    }
    clearDemoRole();
    clear();
    queryClient.clear(); // drop cached patient data from memory
    router.replace("/login");
  };
}

"use client";

import Link from "next/link";
import { FlaskRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/hooks/use-session";

/** Always-visible notice while exploring with sample data. */
export function DemoBanner() {
  const mode = useAuthStore((s) => s.mode);
  const logout = useLogout();
  if (mode !== "demo") return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs text-warning">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskRound className="size-3.5" aria-hidden /> Demo mode — all data on screen is fictional sample data.
      </span>
      <span className="text-warning/90">Changes stay in this browser tab and are not saved to a server.</span>
      <span className="flex gap-3">
        <Link href="/demo" className="font-semibold underline underline-offset-2">
          Switch role
        </Link>
        <button type="button" onClick={logout} className="font-semibold underline underline-offset-2">
          Exit demo
        </button>
      </span>
    </div>
  );
}

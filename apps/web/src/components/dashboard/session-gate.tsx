"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_HOME } from "@medcore/types";
import { useAuthStore } from "@/stores/auth-store";
import { refreshSession } from "@/lib/api";
import { DEMO_USERS, loadDemoRole } from "@/lib/demo/session";
import { canAccessPath } from "@/lib/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessDenied } from "@/components/dashboard/access-denied";

/**
 * Restores the session on page load, then guards the dashboard:
 * 1. Already signed in (in memory)  -> continue
 * 2. Refresh cookie is valid (API)  -> live session
 * 3. Demo role chosen in this tab   -> demo session (sample data)
 * 4. Otherwise                      -> redirect to /login
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, setSession, setDemoSession, setAnonymous } = useAuthStore();

  useEffect(() => {
    if (status !== "unknown") return;
    let cancelled = false;
    (async () => {
      const demoRole = loadDemoRole();
      if (demoRole) {
        setDemoSession(DEMO_USERS[demoRole]);
        return;
      }
      try {
        const { user, accessToken } = await refreshSession();
        if (!cancelled) setSession(user, accessToken);
      } catch {
        if (!cancelled) setAnonymous();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, setSession, setDemoSession, setAnonymous]);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status === "authenticated" && user && pathname === "/dashboard") router.replace(ROLE_HOME[user.role]);
  }, [status, user, pathname, router]);

  if (status !== "authenticated" || !user) return <ShellSkeleton />;
  if (!canAccessPath(user.role, pathname)) return <AccessDenied home={ROLE_HOME[user.role]} />;
  return <>{children}</>;
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading your workspace">
      <div className="hidden w-64 border-r bg-sidebar p-4 lg:block">
        <Skeleton className="mb-8 h-8 w-36" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-6 h-10 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    </div>
  );
}

"use client";

import { SessionGate } from "@/components/dashboard/session-gate";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeNotifications } from "@/hooks/use-realtime";

function Shell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)!;
  useRealtimeNotifications();
  return (
    <div className="flex min-h-dvh">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <Topbar user={user} />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <Shell>{children}</Shell>
    </SessionGate>
  );
}

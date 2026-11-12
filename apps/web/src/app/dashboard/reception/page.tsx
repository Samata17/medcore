"use client";

import Link from "next/link";
import { CalendarCheck, CalendarPlus, Clock, Siren, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { AppointmentsTable } from "@/components/modules/appointments-table";
import { RegisterPatientDialog } from "@/components/modules/register-patient-dialog";
import { useAppointments } from "@/lib/hms";

export default function ReceptionHome() {
  const today = useAppointments("today");
  const a = today.data ?? [];
  const active = a.filter((x) => x.status !== "CANCELLED" && x.status !== "NO_SHOW");

  return (
    <>
      <PageHeader
        title="Today's desk"
        description="Confirm bookings, check patients in and keep the queue moving."
        sample={today.isSample}
        actions={
          <>
            <RegisterPatientDialog />
            <Button variant="outline" asChild>
              <Link href="/dashboard/reception/book">
                <CalendarPlus /> Book appointment
              </Link>
            </Button>
          </>
        }
      />
      <StatGrid className="mb-6">
        {today.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Appointments today" value={active.length} icon={CalendarCheck} />
            <StatCard label="Checked in" value={a.filter((x) => x.checkedInAt).length} icon={UserCheck} tone="success" />
            <StatCard label="Awaiting confirmation" value={a.filter((x) => x.status === "PENDING").length} icon={Clock} tone="warning" />
            <StatCard label="Emergencies" value={a.filter((x) => x.emergency).length} icon={Siren} tone="danger" />
          </>
        )}
      </StatGrid>
      <AppointmentsTable
        actor="reception"
        data={today.data}
        isLoading={today.isLoading}
        isError={today.isError}
        onRetry={() => today.refetch()}
        pageSize={12}
      />
    </>
  );
}

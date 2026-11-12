"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { AppointmentsTable } from "@/components/modules/appointments-table";
import { BookAppointmentForm } from "@/components/modules/book-appointment-form";
import { DEMO_PATIENT_ID, useAppointments, useDoctors } from "@/lib/hms";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

function PatientAppointments() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "history";
  const mine = useAppointments("mine");
  const doctors = useDoctors();
  const user = useAuthStore((s) => s.user)!;
  // In live mode the API books for the signed-in patient; the id is only used by demo mode.
  const selfId = useAuthStore.getState().mode === "demo" ? DEMO_PATIENT_ID : user.id;

  return (
    <>
      <PageHeader title="Appointments" description="Book a visit, see your history and cancel if plans change." sample={mine.isSample} />
      <Tabs value={tab} onValueChange={(t) => router.replace(`?tab=${t}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="history">My appointments</TabsTrigger>
          <TabsTrigger value="book">Book</TabsTrigger>
          <TabsTrigger value="doctors">Doctors</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <AppointmentsTable actor="patient" showDate hidePatient data={mine.data} isLoading={mine.isLoading} isError={mine.isError} onRetry={() => mine.refetch()} />
        </TabsContent>

        <TabsContent value="book">
          <BookAppointmentForm fixedPatientId={selfId} onBooked={() => mine.refetch()} />
        </TabsContent>

        <TabsContent value="doctors">
          {doctors.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(doctors.data ?? []).map((d) => (
                <Card key={d.id} className="gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name} className="size-11" />
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold">{d.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{d.specialization}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="info">{d.department}</Badge>
                    <Badge variant="neutral">{d.experienceYears} yrs experience</Badge>
                    {d.available ? <Badge variant="success">Accepting bookings</Badge> : <Badge variant="warning">On leave</Badge>}
                  </div>
                  <p className="text-sm">
                    Consultation <span className="font-semibold">{formatCurrency(d.consultationFee)}</span>
                  </p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PatientAppointments />
    </Suspense>
  );
}

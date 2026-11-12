"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorState } from "@/components/dashboard/states";
import { BookAppointmentForm } from "@/components/modules/book-appointment-form";
import { usePatients } from "@/lib/hms";

function Book() {
  const preselect = useSearchParams().get("patient") ?? undefined;
  const patients = usePatients();

  return (
    <>
      <PageHeader title="Book appointment" description="Pick a doctor and a free slot. Double-booking is blocked." sample={patients.isSample} />
      {patients.isLoading ? (
        <Skeleton className="h-96" />
      ) : patients.isError ? (
        <ErrorState onRetry={() => patients.refetch()} />
      ) : (
        <BookAppointmentForm key={preselect} patients={patients.data} allowEmergency defaultPatientId={preselect} />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Book />
    </Suspense>
  );
}

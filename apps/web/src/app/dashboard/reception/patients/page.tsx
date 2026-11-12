"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PatientsTable } from "@/components/modules/patients-table";
import { RegisterPatientDialog } from "@/components/modules/register-patient-dialog";
import { usePatients } from "@/lib/hms";

function ReceptionPatients() {
  const router = useRouter();
  const q = useSearchParams().get("q") ?? "";
  const patients = usePatients();
  return (
    <>
      <PageHeader
        title="Patients"
        description="Find an existing patient before registering a new one to avoid duplicate records."
        sample={patients.isSample}
        actions={<RegisterPatientDialog onRegistered={(p) => router.push(`/dashboard/reception/book?patient=${p.id}`)} />}
      />
      <PatientsTable
        key={q}
        initialSearch={q}
        data={patients.data}
        isLoading={patients.isLoading}
        isError={patients.isError}
        onRetry={() => patients.refetch()}
        rowAction={(p) => ({ label: "Book", href: `/dashboard/reception/book?patient=${p.id}` })}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ReceptionPatients />
    </Suspense>
  );
}

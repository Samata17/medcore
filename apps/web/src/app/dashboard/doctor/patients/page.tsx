"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PatientsTable } from "@/components/modules/patients-table";
import { usePatients } from "@/lib/hms";

function DoctorPatients() {
  const q = useSearchParams().get("q") ?? "";
  const patients = usePatients();
  return (
    <>
      <PageHeader title="Patients" description="Search by name, MRN or phone and open the medical record." sample={patients.isSample} />
      <PatientsTable
        key={q}
        initialSearch={q}
        data={patients.data}
        isLoading={patients.isLoading}
        isError={patients.isError}
        onRetry={() => patients.refetch()}
        rowAction={(p) => ({ label: "Open record", href: `/dashboard/doctor/patients/${p.id}` })}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <DoctorPatients />
    </Suspense>
  );
}

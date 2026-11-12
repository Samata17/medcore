"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { EncounterNotes } from "@/components/modules/record/notes";
import { PatientHeader } from "@/components/modules/record/patient-header";
import { PrescriptionList } from "@/components/modules/record/prescriptions";
import { RecordOverview } from "@/components/modules/record/record-overview";
import { VitalsHistory } from "@/components/modules/record/vitals";
import { LabReportCard } from "@/components/modules/lab/lab-report";
import { useMyRecord } from "@/lib/hms";

function Records() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "overview";
  const record = useMyRecord();

  if (record.isLoading) return <Skeleton className="h-96" />;
  if (record.isError || !record.data) return <ErrorState message={record.error?.message} onRetry={() => record.refetch()} />;
  const r = record.data;

  return (
    <>
      <PageHeader title="Medical records" description="Your health history. Only you and your care team can see this." sample={record.isSample} />
      <PatientHeader patient={r.patient} />
      <Tabs value={tab} onValueChange={(t) => router.replace(`?tab=${t}`, { scroll: false })} className="mt-6">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="visits">Visits</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="lab">Lab reports</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <RecordOverview record={r} sample={record.isSample} />
        </TabsContent>
        <TabsContent value="visits">
          <EncounterNotes patientId={r.patient.id} notes={r.notes} readOnly />
        </TabsContent>
        <TabsContent value="vitals">
          <VitalsHistory vitals={r.vitals} />
        </TabsContent>
        <TabsContent value="prescriptions">
          <PrescriptionList prescriptions={r.prescriptions} patient={r.patient} />
        </TabsContent>
        <TabsContent value="lab" className="grid gap-4">
          <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Reports appear here after the laboratory approves them. Flags show values outside the reference range — please discuss results with your doctor.
          </p>
          {r.labOrders.length === 0 ? <EmptyState title="No approved reports yet" /> : r.labOrders.map((o) => <LabReportCard key={o.id} order={o} />)}
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Records />
    </Suspense>
  );
}

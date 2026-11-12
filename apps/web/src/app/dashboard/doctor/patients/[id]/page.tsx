"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SampleDataBadge } from "@/components/dashboard/sample-data-badge";
import { ErrorState } from "@/components/dashboard/states";
import { DiagnosisFormCard, DiagnosisList } from "@/components/modules/record/diagnoses";
import { EncounterNotes } from "@/components/modules/record/notes";
import { PatientHeader } from "@/components/modules/record/patient-header";
import { PrescriptionBuilder, PrescriptionList } from "@/components/modules/record/prescriptions";
import { RecordOverview } from "@/components/modules/record/record-overview";
import { VitalsForm, VitalsHistory } from "@/components/modules/record/vitals";
import { LabOrderForm } from "@/components/modules/lab/lab-order-form";
import { LabReportCard } from "@/components/modules/lab/lab-report";
import { usePatientRecord } from "@/lib/hms";

const TABS = ["overview", "vitals", "diagnosis", "notes", "prescriptions", "lab"] as const;

function Encounter() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = TABS.includes(params.get("tab") as (typeof TABS)[number]) ? params.get("tab")! : "overview";
  const record = usePatientRecord(id);

  if (record.isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (record.isError || !record.data) {
    return <ErrorState message={record.error?.message ?? "Patient not found."} onRetry={() => record.refetch()} />;
  }

  const r = record.data;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/doctor">
            <ArrowLeft /> My day
          </Link>
        </Button>
        {record.isSample && <SampleDataBadge />}
      </div>
      <PatientHeader patient={r.patient} />

      <Tabs value={tab} onValueChange={(t) => router.replace(`?tab=${t}`, { scroll: false })} className="mt-6">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
            <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
            <TabsTrigger value="notes">Notes & plan</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="lab">Lab</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <RecordOverview record={r} sample={record.isSample} />
        </TabsContent>

        <TabsContent value="vitals" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Record vitals</CardTitle>
              <CardDescription>BMI is calculated automatically from height and weight.</CardDescription>
            </CardHeader>
            <CardContent>
              <VitalsForm patientId={id} />
            </CardContent>
          </Card>
          <VitalsHistory vitals={r.vitals} />
        </TabsContent>

        <TabsContent value="diagnosis" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Add diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <DiagnosisFormCard patientId={id} />
            </CardContent>
          </Card>
          <DiagnosisList diagnoses={r.diagnoses} />
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Encounter notes & treatment plan</CardTitle>
              <CardDescription>Notes can&apos;t be edited or deleted. Corrections are saved as new entries linked to the original.</CardDescription>
            </CardHeader>
            <CardContent>
              <EncounterNotes patientId={id} notes={r.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>New prescription</CardTitle>
              <CardDescription>Issued prescriptions go straight to the pharmacy queue.</CardDescription>
            </CardHeader>
            <CardContent>
              <PrescriptionBuilder patient={r.patient} />
            </CardContent>
          </Card>
          <PrescriptionList prescriptions={r.prescriptions} patient={r.patient} />
        </TabsContent>

        <TabsContent value="lab" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order a test</CardTitle>
            </CardHeader>
            <CardContent>
              <LabOrderForm patientId={id} />
            </CardContent>
          </Card>
          {r.labOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lab orders yet.</p>
          ) : (
            r.labOrders.map((o) => <LabReportCard key={o.id} order={o} />)
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Encounter />
    </Suspense>
  );
}

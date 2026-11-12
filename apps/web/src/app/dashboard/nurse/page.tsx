"use client";

import { useState } from "react";
import { Activity, BedDouble, HeartPulse, Pill } from "lucide-react";
import type { WardPatient } from "@/lib/hms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { VitalsForm, vitalFlags } from "@/components/modules/record/vitals";
import { useAddMedicationNote, useMedicationNotes, useWardPatients } from "@/lib/hms";
import { formatRelative } from "@/lib/format";

const VITALS_DUE_HOURS = 2;

function MedicationNoteForm({ patients }: { patients: WardPatient[] }) {
  const add = useAddMedicationNote();
  const [form, setForm] = useState({ patientId: "", medicine: "", dose: "", note: "" });
  const [error, setError] = useState("");
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const patient = patients.find((p) => p.patient.id === form.patientId);
        if (!patient || form.medicine.trim().length < 2 || !form.dose.trim()) return setError("Patient, medicine and dose are required");
        setError("");
        add.mutate(
          { patientId: patient.patient.id, patientName: patient.patient.name, medicine: form.medicine.trim(), dose: form.dose.trim(), note: form.note.trim() || undefined },
          { onSuccess: () => setForm({ patientId: "", medicine: "", dose: "", note: "" }) },
        );
      }}
      className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2"
    >
      <FormField id="mn-patient" label="Patient" required>
        {(a) => (
          <NativeSelect {...a} value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
            <option value="">Select…</option>
            {patients.map((p) => (
              <option key={p.patient.id} value={p.patient.id}>
                {p.patient.name} · {p.bed.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="mn-med" label="Medicine" required>
        {(a) => <Input {...a} value={form.medicine} onChange={(e) => setForm({ ...form, medicine: e.target.value })} />}
      </FormField>
      <FormField id="mn-dose" label="Dose given" required>
        {(a) => <Input {...a} placeholder="1 tab / 5 ml" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />}
      </FormField>
      <FormField id="mn-note" label="Note">
        {(a) => <Input {...a} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}
      </FormField>
      {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2 sm:text-right">
        <Button type="submit" loading={add.isPending}>
          <Pill /> Record administration
        </Button>
      </div>
    </form>
  );
}

export default function NurseHome() {
  const ward = useWardPatients();
  const notes = useMedicationNotes();
  const [vitalsFor, setVitalsFor] = useState<WardPatient | null>(null);
  const list = ward.data ?? [];
  const due = list.filter((p) => !p.lastVitals || Date.now() - new Date(p.lastVitals.recordedAt).getTime() > VITALS_DUE_HOURS * 3_600_000);
  const flagged = list.filter((p) => p.lastVitals && vitalFlags(p.lastVitals).length);

  return (
    <>
      <PageHeader title="Ward overview" description="Assigned patients, vitals rounds and medication administration." sample={ward.isSample} />
      <StatGrid className="mb-6">
        {ward.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Assigned patients" value={list.length} icon={BedDouble} />
            <StatCard label={`Vitals due (>${VITALS_DUE_HOURS} h)`} value={due.length} icon={Activity} tone="warning" />
            <StatCard label="Abnormal last vitals" value={flagged.length} icon={HeartPulse} tone="danger" />
            <StatCard label="Medications given today" value={(notes.data ?? []).filter((n) => new Date(n.givenAt).toDateString() === new Date().toDateString()).length} icon={Pill} tone="teal" />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assigned patients</CardTitle>
            <CardDescription>Record vitals at each round. Abnormal values are highlighted.</CardDescription>
          </CardHeader>
          <CardContent>
            {ward.isLoading ? (
              <Skeleton className="h-60" />
            ) : ward.isError ? (
              <ErrorState onRetry={() => ward.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState title="No assigned patients" />
            ) : (
              <ul className="grid gap-2">
                {list.map((p) => {
                  const flags = p.lastVitals ? vitalFlags(p.lastVitals) : [];
                  const isDue = due.includes(p);
                  return (
                    <li key={p.bed.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-primary">{p.bed.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{p.patient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.lastVitals
                            ? `BP ${p.lastVitals.systolic ?? "—"}/${p.lastVitals.diastolic ?? "—"} · Pulse ${p.lastVitals.pulse ?? "—"} · SpO₂ ${p.lastVitals.spo2 ?? "—"}% · ${formatRelative(p.lastVitals.recordedAt)}`
                            : "No vitals recorded yet"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {flags.length > 0 && <Badge variant="danger">{flags.join(", ")}</Badge>}
                        {isDue && <Badge variant="warning">Due</Badge>}
                        {p.patient.allergies.length > 0 && <Badge variant="danger">Allergy</Badge>}
                      </div>
                      <Button size="sm" variant={isDue ? "default" : "outline"} onClick={() => setVitalsFor(p)}>
                        Record vitals
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Medication administration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <MedicationNoteForm patients={list} />
            {notes.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="grid gap-2">
                {(notes.data ?? []).slice(0, 8).map((n) => (
                  <li key={n.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {n.medicine} <span className="font-normal text-muted-foreground">· {n.dose}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.patientName} · by {n.givenBy} · {formatRelative(n.givenAt)}
                    </p>
                    {n.note && <p className="mt-1 text-xs">{n.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={vitalsFor !== null} onOpenChange={(o) => !o && setVitalsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record vitals · {vitalsFor?.patient.name}</DialogTitle>
            <DialogDescription>
              Bed {vitalsFor?.bed.label} · {vitalsFor?.patient.mrn}
            </DialogDescription>
          </DialogHeader>
          {vitalsFor && <VitalsForm patientId={vitalsFor.patient.id} onSaved={() => setVitalsFor(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

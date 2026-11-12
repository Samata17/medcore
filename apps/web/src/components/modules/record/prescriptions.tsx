"use client";

import { useMemo, useState } from "react";
import { FileText, Plus, Printer, Search, Trash2 } from "lucide-react";
import { stockSummary, type PrescriptionItemRow, type PrescriptionRow, type PatientRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/states";
import { LogoMark } from "@/components/logo";
import { useBatches, useCreatePrescription } from "@/lib/hms";
import { ageFrom, formatDate, formatDateTime } from "@/lib/format";
import { useHospitalName } from "@/hooks/use-session";

const FREQUENCIES = [
  { value: "1-0-0", label: "1-0-0 (morning)" },
  { value: "0-0-1", label: "0-0-1 (night)" },
  { value: "1-0-1", label: "1-0-1 (twice daily)" },
  { value: "1-1-1", label: "1-1-1 (thrice daily)" },
  { value: "0-1-0", label: "0-1-0 (afternoon)" },
  { value: "As needed", label: "As needed (SOS)" },
];

/** Doses per day from a "1-0-1" pattern; SOS counts as 1. */
const dosesPerDay = (f: string) => (/^\d-\d-\d$/.test(f) ? f.split("-").reduce((s, n) => s + Number(n), 0) : 1);

const RX_STATUS = {
  ISSUED: ["Sent to pharmacy", "warning"],
  PARTIALLY_DISPENSED: ["Partially dispensed", "info"],
  DISPENSED: ["Dispensed", "success"],
  CANCELLED: ["Cancelled", "neutral"],
} as const;

export function PrescriptionStatusBadge({ status }: { status: PrescriptionRow["status"] }) {
  const [label, variant] = RX_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function PrescriptionBuilder({ patient }: { patient: PatientRow }) {
  const batches = useBatches();
  const create = useCreatePrescription(patient.id);
  const medicines = useMemo(() => stockSummary(batches.data ?? []), [batches.data]);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PrescriptionItemRow[]>([]);
  const [draft, setDraft] = useState({ medicineId: "", dosage: "", frequency: "1-0-1", durationDays: 5, instructions: "" });
  const [error, setError] = useState("");

  const matches = query.trim()
    ? medicines.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.category.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];
  const selected = medicines.find((m) => m.medicineId === draft.medicineId);
  const allergyHit = selected && patient.allergies.some((a) => selected.name.toLowerCase().includes(a.toLowerCase().split(" ")[0]));

  function addItem() {
    if (!selected) return setError("Choose a medicine from the list");
    if (!draft.dosage.trim()) return setError("Enter the dosage, e.g. 500 mg");
    if (draft.durationDays < 1 || draft.durationDays > 180) return setError("Duration must be 1–180 days");
    if (items.some((i) => i.medicineId === selected.medicineId)) return setError("This medicine is already on the prescription");
    setError("");
    setItems((list) => [
      ...list,
      {
        medicineId: selected.medicineId,
        medicineName: selected.name,
        dosage: draft.dosage.trim(),
        frequency: draft.frequency,
        durationDays: draft.durationDays,
        instructions: draft.instructions.trim() || undefined,
        quantity: dosesPerDay(draft.frequency) * draft.durationDays,
      },
    ]);
    setDraft({ medicineId: "", dosage: "", frequency: "1-0-1", durationDays: 5, instructions: "" });
    setQuery("");
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative grid gap-2">
          <label htmlFor="rx-search" className="text-sm font-medium">
            Medicine
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="rx-search"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="rx-options"
              autoComplete="off"
              className="pl-9"
              placeholder={selected ? selected.name : "Search by name or category"}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDraft((d) => ({ ...d, medicineId: "" }));
              }}
            />
          </div>
          {matches.length > 0 && (
            <ul id="rx-options" role="listbox" className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
              {matches.map((m) => (
                <li key={m.medicineId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setDraft((d) => ({ ...d, medicineId: m.medicineId, dosage: m.name.match(/\d+\s?(mg|g|ml)/i)?.[0] ?? "" }));
                      setQuery("");
                    }}
                  >
                    <span>
                      {m.name} <span className="text-xs text-muted-foreground">· {m.category}</span>
                    </span>
                    <Badge variant={m.quantity === 0 ? "danger" : m.low ? "warning" : "success"}>{m.quantity} in stock</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selected.name}</span>
            </p>
          )}
          {allergyHit && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              Warning: patient has a recorded allergy that may relate to this medicine.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField id="rx-dose" label="Dosage">
            {(a) => <Input {...a} value={draft.dosage} onChange={(e) => setDraft({ ...draft, dosage: e.target.value })} placeholder="500 mg" />}
          </FormField>
          <FormField id="rx-freq" label="Frequency">
            {(a) => (
              <NativeSelect {...a} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="rx-days" label="Duration (days)">
            {(a) => (
              <Input {...a} type="number" min={1} max={180} value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })} />
            )}
          </FormField>
          <FormField id="rx-instr" label="Instructions">
            {(a) => <Input {...a} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="After meals" />}
          </FormField>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus /> Add to prescription
        </Button>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Medicine</th>
                <th className="px-3 py-2 text-left font-medium">Dose · Frequency</th>
                <th className="px-3 py-2 text-left font-medium">Days</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((i) => (
                <tr key={i.medicineId}>
                  <td className="px-3 py-2">
                    {i.medicineName}
                    {i.instructions && <span className="block text-xs text-muted-foreground">{i.instructions}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {i.dosage} · {i.frequency}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{i.durationDays}</td>
                  <td className="px-3 py-2 tabular-nums">{i.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.medicineName}`} onClick={() => setItems(items.filter((x) => x.medicineId !== i.medicineId))}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!items.length} loading={create.isPending} onClick={() => create.mutate({ items }, { onSuccess: () => setItems([]) })}>
          <FileText /> Issue prescription ({items.length})
        </Button>
      </div>
    </div>
  );
}

/** Printable prescription. "Print" opens the browser dialog, where "Save as PDF" exports it. */
export function PrescriptionPrintDialog({ rx, patient }: { rx: PrescriptionRow; patient: PatientRow }) {
  const hospitalName = useHospitalName();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Printer /> Print / PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prescription {rx.code}</DialogTitle>
          <DialogDescription>Use your browser&apos;s &quot;Save as PDF&quot; option in the print dialog to export a PDF.</DialogDescription>
        </DialogHeader>
        <div className="print-area rounded-lg border bg-white p-6 text-slate-900">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <LogoMark />
              <div>
                <p className="font-display text-lg font-bold">{hospitalName}</p>
                <p className="text-xs text-slate-500">Prescription · {rx.code}</p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold">{rx.doctorName}</p>
              <p className="text-slate-500">{formatDateTime(rx.issuedAt)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-slate-200 py-3 text-sm">
            <p>
              <span className="text-slate-500">Patient: </span>
              {patient.name}
            </p>
            <p>
              <span className="text-slate-500">MRN: </span>
              {patient.mrn}
            </p>
            <p>
              <span className="text-slate-500">Age / Sex: </span>
              {ageFrom(patient.dateOfBirth)} y / {patient.gender.charAt(0)}
            </p>
            <p>
              <span className="text-slate-500">Allergies: </span>
              {patient.allergies.join(", ") || "None known"}
            </p>
          </div>
          <p className="pt-3 font-display text-2xl font-bold text-slate-400">℞</p>
          <ol className="mt-2 grid gap-3 text-sm">
            {rx.items.map((i, n) => (
              <li key={i.medicineId} className="flex gap-3">
                <span className="text-slate-400">{n + 1}.</span>
                <div>
                  <p className="font-semibold">{i.medicineName}</p>
                  <p>
                    {i.dosage} · {i.frequency} · {i.durationDays} days · Qty {i.quantity}
                  </p>
                  {i.instructions && <p className="text-slate-500">{i.instructions}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-end">
            <div className="w-48 border-t border-slate-300 pt-1 text-center text-xs text-slate-500">{rx.doctorName}</div>
          </div>
          <p className="mt-6 text-[10px] text-slate-400">Generated by MedCore HMS on {formatDate(new Date())}. Academic project — not valid for real-world dispensing.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrescriptionList({ prescriptions, patient }: { prescriptions: PrescriptionRow[]; patient: PatientRow }) {
  if (!prescriptions.length) return <EmptyState title="No prescriptions yet" className="py-8" />;
  return (
    <ul className="grid gap-3">
      {prescriptions.map((rx) => (
        <li key={rx.id} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {rx.code} <span className="font-normal text-muted-foreground">· {rx.doctorName}</span>
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(rx.issuedAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <PrescriptionStatusBadge status={rx.status} />
              <PrescriptionPrintDialog rx={rx} patient={patient} />
            </div>
          </div>
          <ul className="grid gap-1 text-sm">
            {rx.items.map((i) => (
              <li key={i.medicineId} className="text-muted-foreground">
                <span className="text-foreground">{i.medicineName}</span> — {i.dosage}, {i.frequency}, {i.durationDays} days
                {i.instructions ? ` (${i.instructions})` : ""}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

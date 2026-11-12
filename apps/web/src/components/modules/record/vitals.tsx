"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity } from "lucide-react";
import type { VitalRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/dashboard/data-table";
import { useRecordVitals } from "@/lib/hms";
import { bmiCategory, calculateBmi, formatDateTime } from "@/lib/format";
import { vitalsSchema, type VitalsForm as VitalsFormValues } from "@/lib/validators/clinical";

const FIELDS: { name: keyof VitalsFormValues; label: string; unit: string; step?: string }[] = [
  { name: "systolic", label: "Systolic BP", unit: "mmHg" },
  { name: "diastolic", label: "Diastolic BP", unit: "mmHg" },
  { name: "pulse", label: "Pulse", unit: "bpm" },
  { name: "temperatureC", label: "Temperature", unit: "°C", step: "0.1" },
  { name: "spo2", label: "SpO₂", unit: "%" },
  { name: "heightCm", label: "Height", unit: "cm" },
  { name: "weightKg", label: "Weight", unit: "kg", step: "0.1" },
];

/** Flags common out-of-range adult vitals for quick attention (not a diagnosis). */
export function vitalFlags(v: Partial<VitalRow>) {
  const f: string[] = [];
  if (v.systolic && (v.systolic >= 140 || v.systolic < 90)) f.push("BP");
  if (v.pulse && (v.pulse > 100 || v.pulse < 50)) f.push("Pulse");
  if (v.temperatureC && v.temperatureC >= 38) f.push("Fever");
  if (v.spo2 && v.spo2 < 94) f.push("SpO₂");
  return f;
}

export function VitalsForm({ patientId, onSaved }: { patientId: string; onSaved?: () => void }) {
  const record = useRecordVitals(patientId);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<VitalsFormValues>({ resolver: zodResolver(vitalsSchema) });

  const [h, w] = useWatch({ control, name: ["heightCm", "weightKg"] });
  const bmi = calculateBmi(Number(w) || undefined, Number(h) || undefined);
  const cat = bmi ? bmiCategory(bmi) : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((raw) => {
        const v = vitalsSchema.parse(raw);
        record.mutate(v, {
          onSuccess: () => {
            reset({});
            onSaved?.();
          },
        });
      })}
      className="grid gap-4"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <FormField key={f.name} id={`v-${f.name}`} label={`${f.label} (${f.unit})`} error={errors[f.name]?.message}>
            {(a) => <Input {...a} type="number" inputMode="decimal" step={f.step ?? "1"} {...register(f.name)} />}
          </FormField>
        ))}
        <div className="grid gap-2">
          <span className="text-sm font-medium">BMI (auto)</span>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 text-sm" aria-live="polite">
            {bmi ? (
              <>
                <span className="font-semibold tabular-nums">{bmi}</span>
                <Badge variant={cat!.tone}>{cat!.label}</Badge>
              </>
            ) : (
              <span className="text-muted-foreground">Enter height & weight</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={record.isPending}>
          <Activity /> Save vitals
        </Button>
      </div>
    </form>
  );
}

export function VitalsHistory({ vitals }: { vitals: VitalRow[] }) {
  return (
    <DataTable
      data={vitals}
      getRowId={(v) => v.id}
      pageSize={5}
      emptyTitle="No vitals recorded yet"
      caption="Vitals history"
      columns={[
        { id: "at", header: "Recorded", sortValue: (v) => v.recordedAt, cell: (v) => <span className="whitespace-nowrap">{formatDateTime(v.recordedAt)}<span className="block text-xs text-muted-foreground">{v.recordedBy}</span></span> },
        { id: "bp", header: "BP", cell: (v) => (v.systolic ? `${v.systolic}/${v.diastolic}` : "—") },
        { id: "pulse", header: "Pulse", cell: (v) => v.pulse ?? "—" },
        { id: "temp", header: "Temp °C", hideBelow: "sm", cell: (v) => v.temperatureC ?? "—" },
        { id: "spo2", header: "SpO₂", hideBelow: "sm", cell: (v) => (v.spo2 ? `${v.spo2}%` : "—") },
        { id: "bmi", header: "BMI", hideBelow: "md", cell: (v) => v.bmi ?? "—" },
        {
          id: "flags",
          header: "Flags",
          cell: (v) => {
            const f = vitalFlags(v);
            return f.length ? <Badge variant="danger">{f.join(", ")}</Badge> : <Badge variant="success">Normal</Badge>;
          },
        },
      ]}
    />
  );
}

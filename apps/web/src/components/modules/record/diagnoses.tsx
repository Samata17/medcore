"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import type { DiagnosisRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/states";
import { useAddDiagnosis } from "@/lib/hms";
import { formatDateTime } from "@/lib/format";
import { diagnosisSchema, type DiagnosisForm } from "@/lib/validators/clinical";

export function DiagnosisList({ diagnoses }: { diagnoses: DiagnosisRow[] }) {
  if (!diagnoses.length) return <EmptyState title="No diagnoses recorded" className="py-8" />;
  return (
    <ul className="divide-y rounded-xl border">
      {diagnoses.map((d) => (
        <li key={d.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {d.code && <span className="mr-2 font-mono text-xs text-muted-foreground">{d.code}</span>}
              {d.description}
            </p>
            <p className="text-xs text-muted-foreground">
              {d.recordedBy} · {formatDateTime(d.recordedAt)}
            </p>
          </div>
          <Badge variant={d.type === "FINAL" ? "info" : "warning"}>{d.type === "FINAL" ? "Final" : "Provisional"}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function DiagnosisFormCard({ patientId }: { patientId: string }) {
  const add = useAddDiagnosis(patientId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DiagnosisForm>({ resolver: zodResolver(diagnosisSchema), defaultValues: { code: "", description: "", type: "PROVISIONAL" } });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => add.mutate({ ...v, code: v.code || undefined }, { onSuccess: () => reset() }))}
      className="grid gap-4 sm:grid-cols-[8rem_1fr_10rem_auto] sm:items-start"
    >
      <FormField id="dx-code" label="ICD-10" error={errors.code?.message}>
        {(a) => <Input {...a} placeholder="I10" className="uppercase" {...register("code", { setValueAs: (v: string) => v.toUpperCase() })} />}
      </FormField>
      <FormField id="dx-desc" label="Diagnosis" required error={errors.description?.message}>
        {(a) => <Input {...a} placeholder="Essential hypertension" {...register("description")} />}
      </FormField>
      <FormField id="dx-type" label="Type">
        {(a) => (
          <NativeSelect {...a} {...register("type")}>
            <option value="PROVISIONAL">Provisional</option>
            <option value="FINAL">Final</option>
          </NativeSelect>
        )}
      </FormField>
      <Button type="submit" className="sm:mt-6" loading={add.isPending}>
        <Plus /> Add
      </Button>
    </form>
  );
}

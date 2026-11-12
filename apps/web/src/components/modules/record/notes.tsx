"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, PencilLine } from "lucide-react";
import type { EncounterNote } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/dashboard/states";
import { useAddEncounterNote } from "@/lib/hms";
import { formatDateTime } from "@/lib/format";
import { noteSchema, type NoteForm } from "@/lib/validators/clinical";

/**
 * Clinical notes are append-only: "Correct" creates a new entry that points to
 * the original, and the original stays visible (marked as amended).
 */
export function EncounterNotes({ patientId, notes, readOnly = false }: { patientId: string; notes: EncounterNote[]; readOnly?: boolean }) {
  const [amending, setAmending] = useState<EncounterNote | null>(null);
  const amendedIds = new Set(notes.map((n) => n.amendsId).filter(Boolean));

  return (
    <div className="grid gap-5">
      {!readOnly && <NoteEditor key={amending?.id ?? "new"} patientId={patientId} amending={amending} onDone={() => setAmending(null)} />}
      {notes.length === 0 ? (
        <EmptyState title="No encounter notes yet" className="py-8" />
      ) : (
        <ol className="relative grid gap-4 border-l pl-5">
          {notes.map((n) => (
            <li key={n.id} className="relative">
              <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
              <div className={`rounded-xl border p-4 ${amendedIds.has(n.id) ? "bg-muted/50 opacity-80" : "bg-card"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{n.author}</span>· {formatDateTime(n.createdAt)}
                  {n.amendsId && (
                    <Badge variant="info">
                      <PencilLine /> Correction
                    </Badge>
                  )}
                  {amendedIds.has(n.id) && (
                    <Badge variant="neutral">
                      <History /> Superseded — kept for audit
                    </Badge>
                  )}
                </div>
                {n.amendReason && <p className="mb-2 text-xs text-muted-foreground">Reason for correction: {n.amendReason}</p>}
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase">Symptoms</dt>
                    <dd className="whitespace-pre-line">{n.symptoms}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase">Treatment plan</dt>
                    <dd className="whitespace-pre-line">{n.treatmentPlan}</dd>
                  </div>
                </dl>
                {!readOnly && !amendedIds.has(n.id) && (
                  <Button variant="link" size="sm" className="mt-2 h-auto p-0" onClick={() => setAmending(n)}>
                    Correct this note
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NoteEditor({ patientId, amending, onDone }: { patientId: string; amending: EncounterNote | null; onDone: () => void }) {
  const add = useAddEncounterNote(patientId);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { symptoms: amending?.symptoms ?? "", treatmentPlan: amending?.treatmentPlan ?? "", amendReason: "" },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        if (amending && !v.amendReason?.trim()) {
          setError("amendReason", { message: "Explain why this note is being corrected" });
          return;
        }
        add.mutate(
          { symptoms: v.symptoms, treatmentPlan: v.treatmentPlan, amendsId: amending?.id, amendReason: amending ? v.amendReason : undefined },
          {
            onSuccess: () => {
              reset({ symptoms: "", treatmentPlan: "", amendReason: "" });
              onDone();
            },
          },
        );
      })}
      className="grid gap-4 rounded-xl border bg-muted/30 p-4"
    >
      {amending && (
        <p className="text-sm font-medium text-primary">Correcting the note from {formatDateTime(amending.createdAt)}. The original will be kept.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="n-symptoms" label="Symptoms & findings" required error={errors.symptoms?.message}>
          {(a) => <Textarea {...a} rows={4} {...register("symptoms")} />}
        </FormField>
        <FormField id="n-plan" label="Treatment plan" required error={errors.treatmentPlan?.message}>
          {(a) => <Textarea {...a} rows={4} {...register("treatmentPlan")} />}
        </FormField>
      </div>
      {amending && (
        <FormField id="n-reason" label="Reason for correction" required error={errors.amendReason?.message}>
          {(a) => <Input {...a} {...register("amendReason")} />}
        </FormField>
      )}
      <div className="flex justify-end gap-2">
        {amending && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel correction
          </Button>
        )}
        <Button type="submit" loading={add.isPending}>
          {amending ? "Save correction" : "Save note"}
        </Button>
      </div>
    </form>
  );
}

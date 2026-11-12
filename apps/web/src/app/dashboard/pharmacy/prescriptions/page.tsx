"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { allocateFifo, type PrescriptionRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { PrescriptionStatusBadge } from "@/components/modules/record/prescriptions";
import { useBatches, useDispensePrescription, usePrescriptions } from "@/lib/hms";
import { formatRelative } from "@/lib/format";

export default function PharmacyPrescriptions() {
  const rx = usePrescriptions();
  const batches = useBatches();
  const dispense = useDispensePrescription();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [confirm, setConfirm] = useState<PrescriptionRow | null>(null);

  const list = (rx.data ?? []).filter((r) => (tab === "pending" ? r.status === "ISSUED" || r.status === "PARTIALLY_DISPENSED" : r.status === "DISPENSED"));

  /** FIFO preview: which batches each line would come from, or why it can't be filled. */
  function plan(r: PrescriptionRow) {
    return r.items.map((i) => {
      try {
        return { item: i, picks: allocateFifo(batches.data ?? [], i.medicineId, i.quantity), error: null as string | null };
      } catch (e) {
        return { item: i, picks: [], error: (e as Error).message };
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Prescription fulfilment"
        description="Stock is taken first-in, first-out from the earliest-expiring valid batch. Expired batches are skipped."
        sample={rx.isSample}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "done")} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">To dispense</TabsTrigger>
          <TabsTrigger value="done">Dispensed</TabsTrigger>
        </TabsList>
      </Tabs>

      {rx.isLoading || batches.isLoading ? (
        <Skeleton className="h-64" />
      ) : rx.isError ? (
        <ErrorState onRetry={() => rx.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={PackageCheck} title={tab === "pending" ? "Nothing waiting to be dispensed" : "No dispensed prescriptions yet"} />
        </Card>
      ) : (
        <div className="grid gap-4">
          {list.map((r) => {
            const p = plan(r);
            const blocked = p.some((x) => x.error);
            return (
              <Card key={r.id} className="gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold">
                      {r.code} · {r.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.doctorName} · {formatRelative(r.issuedAt)}
                    </p>
                  </div>
                  <PrescriptionStatusBadge status={r.status} />
                </div>
                <ul className="grid gap-2 text-sm">
                  {p.map(({ item, picks, error }) => (
                    <li key={item.medicineId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <span>
                        <span className="font-medium">{item.medicineName}</span>
                        <span className="text-muted-foreground"> · {item.dosage}, {item.frequency}, {item.durationDays} d · qty {item.quantity}</span>
                      </span>
                      {tab === "pending" &&
                        (error ? (
                          <Badge variant="danger">{error}</Badge>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {picks.map((pk) => (
                              <Badge key={pk.batchId} variant="teal">
                                {pk.batchNo} × {pk.quantity}
                              </Badge>
                            ))}
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
                {tab === "pending" && (
                  <div className="flex items-center justify-end gap-3">
                    {blocked && <p className="text-xs text-destructive">Restock before dispensing — partial dispensing is not allowed.</p>}
                    <Button disabled={blocked} onClick={() => setConfirm(r)}>
                      <PackageCheck /> Dispense
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Dispense ${confirm?.code}?`}
        description="Stock will be deducted from the batches shown and the prescription marked as dispensed."
        confirmLabel="Dispense"
        destructive={false}
        onConfirm={() => confirm && dispense.mutateAsync({ id: confirm.id })}
      />
    </>
  );
}

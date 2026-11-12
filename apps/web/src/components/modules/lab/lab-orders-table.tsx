"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardEdit, Eye, Save } from "lucide-react";
import {
  LAB_ORDER_STATUSES,
  hasAbnormal,
  resultFlag,
  type LabOrderRow,
  type LabResultRow,
} from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/dashboard/data-table";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { LabStatusBadge, labStatusLabel } from "@/components/dashboard/status-badge";
import { AttachmentLinks, LabResultsTable, ResultFlagBadge } from "@/components/modules/lab/lab-report";
import { useAdvanceLabOrder, useApproveLabOrder, useEnterLabResults } from "@/lib/hms";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useLabCatalog } from "@/lib/lab";
import { formatRelative } from "@/lib/format";

/** Structured result entry, with live out-of-range flags and an optional report file. */
function ResultEntryDialog({ order, onClose }: { order: LabOrderRow; onClose: () => void }) {
  const catalog = useLabCatalog();
  const enter = useEnterLabResults();
  const def = catalog.data?.find((t) => t.name === order.testName);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((order.results ?? []).map((r) => [r.parameter, String(r.value)])),
  );
  const [error, setError] = useState("");
  const isLive = useAuthStore((s) => s.mode) === "live";
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const params = def?.parameters ?? order.results?.map(({ parameter, unit, refLow, refHigh }) => ({ parameter, unit, refLow, refHigh })) ?? [];

  /** Same rules as the server (which re-checks the actual file content). */
  function onFile(f: File | undefined) {
    setError("");
    if (!f) return setFile(null);
    if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) return setError("Only PDF, PNG or JPEG files are allowed.");
    if (f.size > 5 * 1024 * 1024) return setError("File must be 5 MB or smaller.");
    setFile(f);
  }

  async function uploadReport() {
    if (!file) return true;
    setUploading(true);
    try {
      await uploadFile(`/lab/orders/${order.id}/report`, file);
      toast.success(`${file.name} attached to ${order.code}`);
      queryClient.invalidateQueries({ predicate: (q) => ["labOrders", "record"].includes(String(q.queryKey[1])) });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setUploading(false);
    }
  }

  function save() {
    const results: LabResultRow[] = [];
    for (const p of params) {
      const raw = values[p.parameter];
      if (raw === undefined || raw.trim() === "" || Number.isNaN(Number(raw))) return setError(`Enter a numeric value for ${p.parameter}.`);
      results.push({ ...p, value: Number(raw) });
    }
    enter.mutate({ id: order.id, results }, { onSuccess: async () => (await uploadReport()) && onClose() });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enter results · {order.code}</DialogTitle>
          <DialogDescription>
            {order.testName} for {order.patientName}. Values outside the reference range are flagged automatically.
          </DialogDescription>
        </DialogHeader>
        {params.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parameters are configured for this test.</p>
        ) : (
          <div className="grid gap-3">
            {params.map((p) => {
              const v = values[p.parameter];
              const num = v !== undefined && v !== "" ? Number(v) : NaN;
              return (
                <div key={p.parameter} className="grid grid-cols-[1fr_7rem_5.5rem] items-center gap-3">
                  <Label htmlFor={`res-${p.parameter}`} className="leading-snug">
                    {p.parameter}
                    <span className="block text-xs font-normal text-muted-foreground">
                      Ref {p.refLow}–{p.refHigh} {p.unit}
                    </span>
                  </Label>
                  <Input
                    id={`res-${p.parameter}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={v ?? ""}
                    onChange={(e) => setValues({ ...values, [p.parameter]: e.target.value })}
                  />
                  <div>{!Number.isNaN(num) && <ResultFlagBadge r={{ ...p, value: num }} />}</div>
                </div>
              );
            })}
          </div>
        )}
        {isLive && (
          <div className="grid gap-2">
            <Label htmlFor="res-file">Report file (optional)</Label>
            <Input id="res-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="text-xs text-muted-foreground">
              PDF, PNG or JPEG up to 5 MB. {file ? `Selected: ${file.name}` : ""}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={enter.isPending || uploading} disabled={!params.length}>
            <Save /> Save results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ order, onClose }: { order: LabOrderRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {order.testName} · {order.code}
          </DialogTitle>
          <DialogDescription>{order.patientName}</DialogDescription>
        </DialogHeader>
        {order.results ? <LabResultsTable results={order.results} /> : <p className="text-sm text-muted-foreground">No results yet.</p>}
        <AttachmentLinks files={order.attachments} />
      </DialogContent>
    </Dialog>
  );
}

const NEXT_LABEL: Partial<Record<LabOrderRow["status"], string>> = {
  ORDERED: "Collect sample",
  SAMPLE_COLLECTED: "Start processing",
};

export function LabOrdersTable({ data, isLoading, isError, onRetry }: { data?: LabOrderRow[]; isLoading?: boolean; isError?: boolean; onRetry?: () => void }) {
  const advance = useAdvanceLabOrder();
  const approve = useApproveLabOrder();
  const [entering, setEntering] = useState<LabOrderRow | null>(null);
  const [viewing, setViewing] = useState<LabOrderRow | null>(null);
  const [approving, setApproving] = useState<LabOrderRow | null>(null);

  return (
    <>
      <DataTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        getRowId={(o) => o.id}
        caption="Laboratory test orders"
        searchText={(o) => `${o.code} ${o.patientName} ${o.testName} ${o.orderedBy}`}
        searchPlaceholder="Search order, patient or test"
        filters={[
          { id: "status", label: "Statuses", options: LAB_ORDER_STATUSES.map((s) => ({ value: s, label: labStatusLabel(s) })), match: (o, v) => o.status === v },
          { id: "priority", label: "Priorities", options: [{ value: "URGENT", label: "Urgent" }, { value: "ROUTINE", label: "Routine" }], match: (o, v) => o.priority === v },
        ]}
        emptyTitle="No test orders"
        columns={[
          {
            id: "order",
            header: "Order",
            sortValue: (o) => o.orderedAt,
            cell: (o) => (
              <div>
                <p className="font-medium">{o.testName}</p>
                <p className="text-xs text-muted-foreground">
                  {o.code} · {formatRelative(o.orderedAt)}
                </p>
              </div>
            ),
          },
          { id: "patient", header: "Patient", sortValue: (o) => o.patientName, cell: (o) => o.patientName },
          { id: "by", header: "Ordered by", hideBelow: "lg", cell: (o) => <span className="text-muted-foreground">{o.orderedBy}</span> },
          {
            id: "priority",
            header: "Priority",
            hideBelow: "md",
            sortValue: (o) => (o.priority === "URGENT" ? 0 : 1),
            cell: (o) => (o.priority === "URGENT" ? <Badge variant="danger">Urgent</Badge> : <Badge variant="neutral">Routine</Badge>),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (o) => LAB_ORDER_STATUSES.indexOf(o.status),
            cell: (o) => (
              <div className="flex flex-col items-start gap-1">
                <LabStatusBadge status={o.status} />
                {hasAbnormal(o.results) && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                    <AlertTriangle className="size-3" aria-hidden />
                    {o.results!.filter((r) => resultFlag(r) !== "NORMAL").length} abnormal
                  </span>
                )}
              </div>
            ),
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (o) => (
              <div className="flex justify-end gap-2">
                {NEXT_LABEL[o.status] && (
                  <Button size="sm" variant="outline" loading={advance.isPending && advance.variables?.id === o.id} onClick={() => advance.mutate({ id: o.id })}>
                    {NEXT_LABEL[o.status]}
                  </Button>
                )}
                {(o.status === "PROCESSING" || o.status === "RESULT_ENTERED") && (
                  <Button size="sm" variant="outline" onClick={() => setEntering(o)}>
                    <ClipboardEdit /> {o.status === "PROCESSING" ? "Enter results" : "Edit"}
                  </Button>
                )}
                {o.status === "RESULT_ENTERED" && (
                  <Button size="sm" onClick={() => setApproving(o)}>
                    <CheckCircle2 /> Approve
                  </Button>
                )}
                {o.status === "APPROVED" && (
                  <Button size="sm" variant="ghost" onClick={() => setViewing(o)}>
                    <Eye /> View
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {entering && <ResultEntryDialog order={entering} onClose={() => setEntering(null)} />}
      {viewing && <ViewDialog order={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(o) => !o && setApproving(null)}
        title="Approve and release this report?"
        description={
          approving
            ? `${approving.testName} for ${approving.patientName} will become visible to the patient and the ordering doctor. ${hasAbnormal(approving.results) ? "This report contains abnormal values." : ""}`
            : ""
        }
        confirmLabel="Approve report"
        destructive={false}
        onConfirm={() => approving && approve.mutateAsync({ id: approving.id })}
      />
    </>
  );
}

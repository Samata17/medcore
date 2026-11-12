"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api";
import { hasAbnormal, resultFlag, type LabOrderRow, type LabResultRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { LabStatusBadge } from "@/components/dashboard/status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ResultFlagBadge({ r }: { r: LabResultRow }) {
  const flag = resultFlag(r);
  if (flag === "NORMAL") return <Badge variant="success">Normal</Badge>;
  return (
    <Badge variant="danger">
      {flag === "HIGH" ? <ArrowUp /> : <ArrowDown />} {flag === "HIGH" ? "High" : "Low"}
    </Badge>
  );
}

export function LabResultsTable({ results }: { results: LabResultRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Parameter</th>
            <th className="px-3 py-2 text-left font-medium">Result</th>
            <th className="px-3 py-2 text-left font-medium">Reference range</th>
            <th className="px-3 py-2 text-left font-medium">Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {results.map((r) => (
            <tr key={r.parameter} className={cn(resultFlag(r) !== "NORMAL" && "bg-destructive-soft/40")}>
              <td className="px-3 py-2">{r.parameter}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">
                {r.value} <span className="font-normal text-muted-foreground">{r.unit}</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">
                {r.refLow} – {r.refHigh} {r.unit}
              </td>
              <td className="px-3 py-2">
                <ResultFlagBadge r={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Download buttons for uploaded report files (permission-checked by the API). */
export function AttachmentLinks({ files }: { files?: { id: string; fileName: string }[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!files?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <Button
            size="sm"
            variant="outline"
            loading={busy === f.id}
            onClick={async () => {
              setBusy(f.id);
              try {
                await downloadFile(`/attachments/${f.id}`, f.fileName);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy !== f.id && <FileDown />} {f.fileName}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function LabReportCard({ order }: { order: LabOrderRow }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{order.testName}</p>
          <p className="text-xs text-muted-foreground">
            {order.code} · ordered by {order.orderedBy} · {formatDateTime(order.orderedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.priority === "URGENT" && <Badge variant="danger">Urgent</Badge>}
          {hasAbnormal(order.results) && <Badge variant="danger">Abnormal values</Badge>}
          <LabStatusBadge status={order.status} />
        </div>
      </div>
      {order.results?.length ? (
        <>
          <LabResultsTable results={order.results} />
          {order.approvedBy && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" aria-hidden /> Approved by {order.approvedBy}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Results not available yet.</p>
      )}
      <AttachmentLinks files={order.attachments} />
    </div>
  );
}

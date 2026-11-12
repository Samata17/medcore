"use client";

import type { ClaimRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { useClaims, useUpdateClaim } from "@/lib/hms";
import { formatCurrency, formatDate } from "@/lib/format";

const STATUS: Record<ClaimRow["status"], { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "teal" }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  UNDER_REVIEW: { label: "Under review", variant: "warning" },
  APPROVED: { label: "Approved", variant: "teal" },
  REJECTED: { label: "Rejected", variant: "danger" },
  SETTLED: { label: "Settled", variant: "success" },
};

/** Claim workflow: the next steps an accountant can record for each state. */
const ACTIONS: Partial<Record<ClaimRow["status"], { to: ClaimRow["status"]; label: string; variant?: "outline" }[]>> = {
  DRAFT: [{ to: "SUBMITTED", label: "Submit to insurer" }],
  SUBMITTED: [{ to: "UNDER_REVIEW", label: "Mark under review", variant: "outline" }],
  UNDER_REVIEW: [
    { to: "APPROVED", label: "Approved" },
    { to: "REJECTED", label: "Rejected", variant: "outline" },
  ],
  APPROVED: [{ to: "SETTLED", label: "Mark settled" }],
  REJECTED: [{ to: "DRAFT", label: "Rework", variant: "outline" }],
};

export default function ClaimsPage() {
  const claims = useClaims();
  const update = useUpdateClaim();
  return (
    <>
      <PageHeader
        title="Insurance claims"
        description="Track each claim from draft to settlement. Insurer integrations can be configured later; statuses are recorded manually for now."
        sample={claims.isSample}
      />
      <DataTable
        data={claims.data}
        isLoading={claims.isLoading}
        isError={claims.isError}
        onRetry={() => claims.refetch()}
        getRowId={(c) => c.id}
        caption="Insurance claims"
        searchText={(c) => `${c.claimNo} ${c.invoiceNumber} ${c.patientName} ${c.insurer}`}
        searchPlaceholder="Search claim, invoice or patient"
        filters={[{ id: "status", label: "Statuses", options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), match: (c, v) => c.status === v }]}
        columns={[
          { id: "claim", header: "Claim", sortValue: (c) => c.submittedAt, cell: (c) => <div><p className="font-medium">{c.claimNo}</p><p className="text-xs text-muted-foreground">{c.invoiceNumber} · {formatDate(c.submittedAt)}</p></div> },
          { id: "patient", header: "Patient", sortValue: (c) => c.patientName, cell: (c) => c.patientName },
          { id: "insurer", header: "Insurer", hideBelow: "md", cell: (c) => c.insurer },
          { id: "amount", header: "Amount", className: "text-right", sortValue: (c) => c.amount, cell: (c) => <span className="tabular-nums">{formatCurrency(c.amount)}</span> },
          { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge> },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (c) => (
              <div className="flex justify-end gap-2">
                {(ACTIONS[c.status] ?? []).map((a) => (
                  <Button key={a.to} size="sm" variant={a.variant ?? "default"} onClick={() => update.mutate({ id: c.id, status: a.to })}>
                    {a.label}
                  </Button>
                ))}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

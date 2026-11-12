"use client";

import { ROLE_LABELS, ROLES } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { useAuditLogs } from "@/lib/hms";
import { formatDateTime } from "@/lib/format";

export default function ActivityPage() {
  const logs = useAuditLogs();
  return (
    <>
      <PageHeader title="Activity logs" description="Who did what, when and from where. Logs are append-only." sample={logs.isSample} />
      <DataTable
        data={logs.data}
        isLoading={logs.isLoading}
        isError={logs.isError}
        onRetry={() => logs.refetch()}
        getRowId={(x) => x.id}
        caption="Audit log"
        pageSize={15}
        searchText={(x) => `${x.actor} ${x.action} ${x.entity} ${x.hospital ?? ""} ${x.ip}`}
        searchPlaceholder="Search user, action, record or IP"
        filters={[{ id: "role", label: "Roles", options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })), match: (x, v) => x.actorRole === v }]}
        columns={[
          { id: "at", header: "Time", sortValue: (x) => x.at, cell: (x) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(x.at)}</span> },
          { id: "actor", header: "User", sortValue: (x) => x.actor, cell: (x) => <div><p className="font-medium">{x.actor}</p><p className="text-xs text-muted-foreground">{ROLE_LABELS[x.actorRole]}</p></div> },
          {
            id: "action",
            header: "Action",
            sortValue: (x) => x.action,
            cell: (x) => <Badge variant={x.action.includes("FAILED") || x.action.includes("SUSPEND") ? "danger" : "neutral"} className="font-mono">{x.action}</Badge>,
          },
          { id: "entity", header: "Record", hideBelow: "md", cell: (x) => x.entity },
          { id: "hospital", header: "Hospital", hideBelow: "lg", cell: (x) => x.hospital ?? <span className="text-muted-foreground">Platform</span> },
          { id: "ip", header: "IP", hideBelow: "lg", cell: (x) => <span className="font-mono text-xs">{x.ip}</span> },
        ]}
      />
    </>
  );
}

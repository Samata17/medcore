"use client";

import { useState } from "react";
import type { HospitalRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable } from "@/components/dashboard/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { HospitalStatusBadge, PLAN_LABEL } from "@/components/modules/hospital-status-badge";
import { useHospitals, useSetHospitalStatus } from "@/lib/hms";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";

type Action = { hospital: HospitalRow; to: HospitalRow["status"] };

export default function HospitalsPage() {
  const hospitals = useHospitals();
  const setStatus = useSetHospitalStatus();
  const [action, setAction] = useState<Action | null>(null);

  const copy = action
    ? action.to === "ACTIVE"
      ? action.hospital.status === "SUSPENDED"
        ? { title: `Reactivate ${action.hospital.name}?`, body: "Staff and patients regain access immediately.", label: "Reactivate", destructive: false }
        : { title: `Verify ${action.hospital.name}?`, body: "Confirm you've checked the registration documents. The hospital admin can then add staff and patients.", label: "Verify hospital", destructive: false }
      : { title: `Suspend ${action.hospital.name}?`, body: "All users of this hospital will be signed out and blocked. Data is kept and nothing is deleted.", label: "Suspend", destructive: true }
    : null;

  return (
    <>
      <PageHeader title="Hospitals" description="Onboarding, verification and access for every tenant." sample={hospitals.isSample} />
      <DataTable
        data={hospitals.data}
        isLoading={hospitals.isLoading}
        isError={hospitals.isError}
        onRetry={() => hospitals.refetch()}
        getRowId={(h) => h.id}
        caption="Hospitals"
        searchText={(h) => `${h.name} ${h.city} ${h.state}`}
        searchPlaceholder="Search hospital or city"
        filters={[
          {
            id: "status",
            label: "Statuses",
            options: [
              { value: "PENDING_VERIFICATION", label: "Pending verification" },
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
            ],
            match: (h, v) => h.status === v,
          },
        ]}
        columns={[
          { id: "name", header: "Hospital", sortValue: (h) => h.name, cell: (h) => <div><p className="font-medium">{h.name}</p><p className="text-xs text-muted-foreground">{h.city}, {h.state}</p></div> },
          { id: "plan", header: "Plan", hideBelow: "md", sortValue: (h) => h.plan, cell: (h) => PLAN_LABEL[h.plan] },
          { id: "beds", header: "Beds", hideBelow: "lg", className: "text-right", sortValue: (h) => h.beds, cell: (h) => <span className="tabular-nums">{h.beds}</span> },
          { id: "patients", header: "Patients", hideBelow: "lg", className: "text-right", sortValue: (h) => h.patients, cell: (h) => <span className="tabular-nums">{formatNumber(h.patients)}</span> },
          { id: "revenue", header: "Monthly revenue", hideBelow: "lg", className: "text-right", sortValue: (h) => h.monthlyRevenue, cell: (h) => <span className="tabular-nums">₹{formatCompact(h.monthlyRevenue)}</span> },
          { id: "since", header: "Since", hideBelow: "md", sortValue: (h) => h.onboardedAt, cell: (h) => formatDate(h.onboardedAt) },
          { id: "status", header: "Status", sortValue: (h) => h.status, cell: (h) => <HospitalStatusBadge status={h.status} /> },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (h) =>
              h.status === "PENDING_VERIFICATION" ? (
                <Button size="sm" onClick={() => setAction({ hospital: h, to: "ACTIVE" })}>
                  Verify
                </Button>
              ) : h.status === "ACTIVE" ? (
                <Button size="sm" variant="outline" onClick={() => setAction({ hospital: h, to: "SUSPENDED" })}>
                  Suspend
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setAction({ hospital: h, to: "ACTIVE" })}>
                  Reactivate
                </Button>
              ),
          },
        ]}
      />
      {copy && (
        <ConfirmDialog
          open={action !== null}
          onOpenChange={(o) => !o && setAction(null)}
          title={copy.title}
          description={copy.body}
          confirmLabel={copy.label}
          destructive={copy.destructive}
          onConfirm={() => action && setStatus.mutateAsync({ id: action.hospital.id, status: action.to })}
        />
      )}
    </>
  );
}

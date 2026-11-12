"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Siren } from "lucide-react";
import { APPOINTMENT_STATUSES, type AppointmentRow, type AppointmentStatus } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { AppointmentStatusBadge, appointmentStatusLabel } from "@/components/dashboard/status-badge";
import { useCheckIn, useUpdateAppointmentStatus } from "@/lib/hms";
import { formatDate, formatTime } from "@/lib/format";

export type AppointmentActor = "reception" | "doctor" | "patient" | "readonly";

/** Row actions allowed for each actor, following the appointment lifecycle. */
function RowActions({ a, actor }: { a: AppointmentRow; actor: AppointmentActor }) {
  const update = useUpdateAppointmentStatus();
  const checkIn = useCheckIn();
  const [confirm, setConfirm] = useState<AppointmentStatus | null>(null);
  const set = (status: AppointmentStatus) => update.mutate({ id: a.id, status });

  if (actor === "readonly") return null;

  if (actor === "doctor") {
    return (
      <div className="flex justify-end gap-2">
        {a.status === "CONFIRMED" && (
          <Button size="sm" variant="outline" loading={update.isPending} onClick={() => set("IN_PROGRESS")}>
            Start
          </Button>
        )}
        {a.status === "IN_PROGRESS" && (
          <Button size="sm" variant="outline" loading={update.isPending} onClick={() => set("COMPLETED")}>
            Complete
          </Button>
        )}
        <Button size="sm" asChild>
          <Link href={`/dashboard/doctor/patients/${a.patientId}`}>Open record</Link>
        </Button>
      </div>
    );
  }

  const cancellable = a.status === "PENDING" || a.status === "CONFIRMED";
  if (actor === "patient") {
    return cancellable ? (
      <>
        <Button size="sm" variant="outline" onClick={() => setConfirm("CANCELLED")}>
          Cancel
        </Button>
        <ConfirmDialog
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Cancel this appointment?"
          description={`${a.doctorName}, ${formatDate(a.startsAt)} at ${formatTime(a.startsAt)}. The slot will be released for other patients.`}
          confirmLabel="Cancel appointment"
          onConfirm={() => update.mutateAsync({ id: a.id, status: "CANCELLED" })}
        />
      </>
    ) : null;
  }

  // Reception
  return (
    <div className="flex items-center justify-end gap-2">
      {a.status === "PENDING" && (
        <Button size="sm" variant="outline" loading={update.isPending} onClick={() => set("CONFIRMED")}>
          Confirm
        </Button>
      )}
      {a.status === "CONFIRMED" && !a.checkedInAt && (
        <Button size="sm" loading={checkIn.isPending} onClick={() => checkIn.mutate({ id: a.id })}>
          Check in
        </Button>
      )}
      {cancellable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${a.patientName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {a.status === "CONFIRMED" && <DropdownMenuItem onSelect={() => setConfirm("NO_SHOW")}>Mark as no-show</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("CANCELLED")}>
              Cancel appointment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "NO_SHOW" ? "Mark as no-show?" : "Cancel this appointment?"}
        description={`${a.patientName} with ${a.doctorName} at ${formatTime(a.startsAt)}. This can't be undone.`}
        confirmLabel={confirm === "NO_SHOW" ? "Mark no-show" : "Cancel appointment"}
        onConfirm={() => confirm && update.mutateAsync({ id: a.id, status: confirm })}
      />
    </div>
  );
}

export function AppointmentsTable({
  data,
  isLoading,
  isError,
  onRetry,
  actor,
  showDate = false,
  hideDoctor = false,
  hidePatient = false,
  initialSearch,
  pageSize = 10,
  toolbar,
}: {
  data?: AppointmentRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  actor: AppointmentActor;
  showDate?: boolean;
  hideDoctor?: boolean;
  hidePatient?: boolean;
  initialSearch?: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
}) {
  const columns: Column<AppointmentRow>[] = [
    {
      id: "time",
      header: showDate ? "Date & time" : "Time",
      sortValue: (a) => a.startsAt,
      cell: (a) => (
        <span className="tabular-nums">
          {showDate && <span className="block text-xs text-muted-foreground">{formatDate(a.startsAt)}</span>}
          {formatTime(a.startsAt)}
        </span>
      ),
    },
    ...(!hidePatient
      ? [
          {
            id: "patient",
            header: "Patient",
            sortValue: (a: AppointmentRow) => a.patientName,
            cell: (a: AppointmentRow) => (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium">
                  {a.patientName}
                  {a.emergency && (
                    <Badge variant="danger" className="px-1.5">
                      <Siren /> Emergency
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{a.patientMrn}</p>
              </div>
            ),
          } satisfies Column<AppointmentRow>,
        ]
      : []),
    ...(!hideDoctor
      ? [
          {
            id: "doctor",
            header: "Doctor",
            hideBelow: "md",
            sortValue: (a: AppointmentRow) => a.doctorName,
            cell: (a: AppointmentRow) => (
              <div>
                <p>{a.doctorName}</p>
                <p className="text-xs text-muted-foreground">{a.department}</p>
              </div>
            ),
          } satisfies Column<AppointmentRow>,
        ]
      : []),
    { id: "reason", header: "Reason", hideBelow: "lg", cell: (a) => <span className="text-muted-foreground">{a.reason}</span> },
    {
      id: "status",
      header: "Status",
      sortValue: (a) => a.status,
      cell: (a) => (
        <div className="flex flex-col items-start gap-1">
          <AppointmentStatusBadge status={a.status} />
          {a.checkedInAt && a.status === "CONFIRMED" && <span className="text-[11px] text-success">Checked in {formatTime(a.checkedInAt)}</span>}
          {hidePatient && a.emergency && <Badge variant="danger">Emergency</Badge>}
        </div>
      ),
    },
    { id: "actions", header: "", className: "text-right", cell: (a) => <RowActions a={a} actor={actor} /> },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      getRowId={(a) => a.id}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      searchText={(a) => `${a.patientName} ${a.patientMrn} ${a.doctorName} ${a.department} ${a.reason}`}
      searchPlaceholder="Search patient, doctor or reason"
      initialSearch={initialSearch}
      filters={[
        {
          id: "status",
          label: "Statuses",
          options: APPOINTMENT_STATUSES.map((s) => ({ value: s, label: appointmentStatusLabel(s) })),
          match: (a, v) => a.status === v,
        },
      ]}
      pageSize={pageSize}
      emptyTitle="No appointments"
      emptyDescription="Appointments will appear here once they're booked."
      toolbar={toolbar}
      caption="Appointments"
    />
  );
}

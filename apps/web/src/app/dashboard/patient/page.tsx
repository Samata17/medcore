"use client";

import Link from "next/link";
import { CalendarCheck, CalendarPlus, FlaskConical, Pill, Receipt } from "lucide-react";
import { hasAbnormal } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { AppointmentStatusBadge, InvoiceStatusBadge } from "@/components/dashboard/status-badge";
import { ErrorState } from "@/components/dashboard/states";
import { NotificationRow } from "@/components/dashboard/notification-center";
import { useCurrentUser } from "@/hooks/use-session";
import { useNotifications } from "@/hooks/use-notifications";
import { useInvoices, useMyRecord } from "@/lib/hms";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

export default function PatientHome() {
  const user = useCurrentUser();
  const record = useMyRecord();
  const invoices = useInvoices("mine");
  const notes = useNotifications();

  if (record.isError) return <ErrorState message={record.error.message} onRetry={() => record.refetch()} />;
  const r = record.data;
  const now = Date.now();
  const upcoming = r?.appointments.filter((a) => new Date(a.startsAt).getTime() > now && (a.status === "PENDING" || a.status === "CONFIRMED")).toSorted((a, b) => a.startsAt.localeCompare(b.startsAt)) ?? [];
  const next = upcoming[0];
  const due = (invoices.data ?? []).filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");

  return (
    <>
      <PageHeader
        title={`Hello, ${user.firstName}`}
        description="Your appointments, records and bills in one place."
        sample={record.isSample}
        actions={
          <Button asChild>
            <Link href="/dashboard/patient/appointments?tab=book">
              <CalendarPlus /> Book appointment
            </Link>
          </Button>
        }
      />

      {!r ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="size-4 text-primary" aria-hidden /> Next appointment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {next ? (
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-accent/60 p-4">
                  <div className="grid size-16 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <span className="text-center leading-tight">
                      <span className="block text-xs">{new Date(next.startsAt).toLocaleDateString("en-IN", { month: "short" })}</span>
                      <span className="font-display text-2xl font-bold">{new Date(next.startsAt).getDate()}</span>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold">{next.doctorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {next.department} · {formatTime(next.startsAt)} · {next.reason}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={next.status} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
              )}
              {upcoming.length > 1 && <p className="mt-3 text-xs text-muted-foreground">+{upcoming.length - 1} more upcoming</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" aria-hidden /> Bills to pay
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.isLoading ? (
                <Skeleton className="h-16" />
              ) : due.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have no outstanding bills.</p>
              ) : (
                <ul className="grid gap-2">
                  {due.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {i.number}
                        <span className="block text-xs text-muted-foreground">Due {formatDate(i.dueAt)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{formatCurrency(i.total - i.paid, true)}</span>
                        <InvoiceStatusBadge status={i.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href="/dashboard/patient/billing">View billing</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-4 text-teal" aria-hidden /> Lab reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {r.labOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved reports yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {r.labOrders.slice(0, 3).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {o.testName}
                        <span className="block text-xs text-muted-foreground">{formatDate(o.orderedAt)}</span>
                      </span>
                      {hasAbnormal(o.results) ? <Badge variant="warning">Review with doctor</Badge> : <Badge variant="success">Normal</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href="/dashboard/patient/records?tab=lab">All reports</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="size-4 text-primary" aria-hidden /> Current prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {r.prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prescriptions.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {r.prescriptions[0].items.map((i) => (
                    <li key={i.medicineId}>
                      <span className="font-medium">{i.medicineName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i.frequency} · {i.durationDays} days{i.instructions ? ` · ${i.instructions}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href="/dashboard/patient/records?tab=prescriptions">All prescriptions</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {(notes.data ?? []).slice(0, 3).map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={(id) => notes.markRead.mutate(id)} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

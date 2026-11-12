"use client";

import Link from "next/link";
import { CalendarCheck, CheckCircle2, Clock, FlaskConical, Siren } from "lucide-react";
import { hasAbnormal } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { AppointmentStatusBadge, LabStatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { AppointmentCalendar } from "@/components/modules/appointment-calendar";
import { PrescriptionStatusBadge } from "@/components/modules/record/prescriptions";
import { useCurrentUser } from "@/hooks/use-session";
import { useAppointments, useLabOrders, usePrescriptions } from "@/lib/hms";
import { formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DoctorHome() {
  const user = useCurrentUser();
  const doctorName = `Dr. ${user.firstName} ${user.lastName}`;
  const today = useAppointments("doctor-today");
  const upcoming = useAppointments("doctor-upcoming");
  const labs = useLabOrders();
  const rx = usePrescriptions();

  const appts = today.data ?? [];
  const myLabs = (labs.data ?? []).filter((o) => o.orderedBy === doctorName);
  const pendingLabs = myLabs.filter((o) => o.status !== "APPROVED" && o.status !== "CANCELLED");
  const readyLabs = myLabs.filter((o) => o.status === "APPROVED").slice(0, 3);
  const myRx = (rx.data ?? []).filter((r) => r.doctorName === doctorName).slice(0, 4);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, Dr. ${user.lastName}`}
        description={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        sample={today.isSample}
        actions={
          <Button asChild>
            <Link href="/dashboard/doctor/patients">Find a patient</Link>
          </Button>
        }
      />

      <StatGrid>
        {today.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Appointments today" value={appts.length} icon={CalendarCheck} />
            <StatCard label="Completed" value={appts.filter((a) => a.status === "COMPLETED").length} icon={CheckCircle2} tone="success" />
            <StatCard label="Waiting / in progress" value={appts.filter((a) => a.status === "IN_PROGRESS" || (a.status === "CONFIRMED" && a.checkedInAt)).length} icon={Clock} tone="teal" />
            <StatCard label="Pending lab reports" value={pendingLabs.length} icon={FlaskConical} tone="warning" />
          </>
        )}
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s timeline</CardTitle>
            <CardDescription>Open a record to record vitals, diagnose, prescribe or order tests.</CardDescription>
          </CardHeader>
          <CardContent>
            {today.isLoading ? (
              <div className="grid gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : today.isError ? (
              <ErrorState message={today.error.message} onRetry={() => today.refetch()} />
            ) : appts.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No appointments today" />
            ) : (
              <ol className="relative grid gap-3 border-l pl-5">
                {appts.map((a) => {
                  const current = a.status === "IN_PROGRESS";
                  const past = new Date(a.endsAt).getTime() < now;
                  return (
                    <li key={a.id} className="relative">
                      <span
                        className={cn(
                          "absolute top-4 -left-[1.6rem] size-2.5 rounded-full border-2 border-card",
                          current ? "bg-primary ring-4 ring-primary/20" : a.emergency ? "bg-destructive" : past ? "bg-muted-foreground/40" : "bg-teal",
                        )}
                        aria-hidden
                      />
                      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", current && "border-primary/40 bg-accent/50")}>
                        <span className="w-16 font-medium tabular-nums">{formatTime(a.startsAt)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 font-medium">
                            {a.patientName}
                            {a.emergency && (
                              <Badge variant="danger">
                                <Siren /> Emergency
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.patientMrn} · {a.reason}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={a.status} />
                        {a.status !== "CANCELLED" && a.status !== "NO_SHOW" && (
                          <Button size="sm" variant={current ? "default" : "outline"} asChild>
                            <Link href={`/dashboard/doctor/patients/${a.patientId}`}>{current ? "Continue" : "Open"}</Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lab reports</CardTitle>
              <CardDescription>Orders you placed</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {labs.isLoading ? (
                <Skeleton className="h-24" />
              ) : pendingLabs.length + readyLabs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent lab orders.</p>
              ) : (
                [...readyLabs, ...pendingLabs].map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/doctor/patients/${o.patientId}?tab=lab`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.testName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.patientName} · {formatRelative(o.orderedAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <LabStatusBadge status={o.status} />
                      {hasAbnormal(o.results) && o.status === "APPROVED" && <Badge variant="danger">Abnormal</Badge>}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent prescriptions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {rx.isLoading ? (
                <Skeleton className="h-24" />
              ) : myRx.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prescriptions issued yet.</p>
              ) : (
                myRx.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {r.code} · {r.patientName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{r.items.map((i) => i.medicineName).join(", ")}</span>
                    </span>
                    <PrescriptionStatusBadge status={r.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Follow-up calendar</CardTitle>
          <CardDescription>Your booked appointments by day</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.isLoading || today.isLoading ? <Skeleton className="h-72" /> : <AppointmentCalendar appointments={[...appts, ...(upcoming.data ?? [])]} />}
        </CardContent>
      </Card>
    </>
  );
}

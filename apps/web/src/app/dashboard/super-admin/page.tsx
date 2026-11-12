"use client";

import Link from "next/link";
import { Building2, CalendarCheck, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, ChartSkeleton, TrendChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { HospitalStatusBadge } from "@/components/modules/hospital-status-badge";
import { usePlatformAnalytics } from "@/lib/analytics";
import { useAuditLogs, useHospitals } from "@/lib/hms";
import { formatCompact, formatCurrency, formatNumber, formatRelative } from "@/lib/format";

export default function SuperAdminHome() {
  const a = usePlatformAnalytics();
  const hospitals = useHospitals();
  const audit = useAuditLogs();
  const d = a.data;
  const pending = (hospitals.data ?? []).filter((h) => h.status === "PENDING_VERIFICATION");

  return (
    <>
      <PageHeader title="Platform overview" description="All hospitals on MedCore." sample={a.isSample} />
      <StatGrid className="mb-6">
        {!d ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Hospitals" value={d.totals.hospitals} icon={Building2} hint={`${d.totals.pendingVerification} awaiting verification`} />
            <StatCard label="Registered patients" value={formatNumber(d.totals.patients)} icon={Users} tone="teal" />
            <StatCard label="Active doctors" value={d.totals.activeDoctors} icon={Stethoscope} tone="success" />
            <StatCard label="Appointments this month" value={formatNumber(d.totals.appointmentsThisMonth)} icon={CalendarCheck} />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Revenue processed across hospitals"
          description="Last 12 months"
          sample={a.isSample}
          table={d ? { columns: ["Month", "Revenue"], rows: d.revenueByMonth.map((r) => [r.month, formatCurrency(r.revenue)]) } : undefined}
        >
          {!d ? <ChartSkeleton /> : <TrendChart kind="bar" data={d.revenueByMonth} xKey="month" series={[{ key: "revenue", label: "Revenue" }]} format={(n) => `₹${formatCompact(n)}`} />}
        </ChartCard>
        <ChartCard
          title="Patient growth"
          description="Total registered patients"
          sample={a.isSample}
          table={d ? { columns: ["Month", "Patients"], rows: d.patientGrowth.map((r) => [r.month, formatNumber(r.patients)]) } : undefined}
        >
          {!d ? <ChartSkeleton /> : <TrendChart kind="area" data={d.patientGrowth} xKey="month" series={[{ key: "patients", label: "Patients", color: 2 }]} format={formatCompact} />}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="grid gap-1">
              <CardTitle>Awaiting verification</CardTitle>
              <CardDescription>New hospitals can&apos;t access patient features until verified.</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/super-admin/hospitals">Review</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {hospitals.isLoading ? (
              <Skeleton className="h-24" />
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hospitals waiting.</p>
            ) : (
              <ul className="grid gap-2">
                {pending.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>
                      <span className="font-medium">{h.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {h.city}, {h.state} · applied {formatRelative(h.onboardedAt)}
                      </span>
                    </span>
                    <HospitalStatusBadge status={h.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Platform activity</CardTitle>
            <Link href="/dashboard/super-admin/activity" className="text-sm font-medium text-primary hover:underline">
              All logs
            </Link>
          </CardHeader>
          <CardContent>
            {audit.isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <ul className="grid gap-3">
                {(audit.data ?? []).slice(0, 6).map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{x.actor}</span> <span className="text-muted-foreground">{x.action.toLowerCase().replaceAll("_", " ")}</span>
                      <span className="block text-xs text-muted-foreground">
                        {x.entity}
                        {x.hospital ? ` · ${x.hospital}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(x.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

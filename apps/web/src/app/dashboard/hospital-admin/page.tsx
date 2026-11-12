"use client";

import Link from "next/link";
import { BedDouble, IndianRupee, PackageX, Stethoscope, Users } from "lucide-react";
import { stockSummary } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarList, ChartCard, ChartSkeleton, TrendChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { appointmentStatusLabel } from "@/components/dashboard/status-badge";
import { useHospitalAnalytics } from "@/lib/analytics";
import { useHospitalName } from "@/hooks/use-session";
import { useAuditLogs, useBatches } from "@/lib/hms";
import { formatCompact, formatCurrency, formatRelative } from "@/lib/format";

export default function HospitalAdminHome() {
  const a = useHospitalAnalytics();
  const batches = useBatches();
  const audit = useAuditLogs();
  const low = stockSummary(batches.data ?? []).filter((m) => m.low);
  const d = a.data;
  const hospitalName = useHospitalName();
  // Live: the API already returns only this hospital's logs. Demo: filter the shared sample list.
  const activity = (audit.data ?? []).filter((x) => !audit.isSample || x.hospital === hospitalName).slice(0, 6);

  return (
    <>
      <PageHeader title="Hospital overview" description={hospitalName} sample={a.isSample} />
      <StatGrid className="mb-6 xl:grid-cols-4">
        {a.isLoading || !d ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Today's patients" value={d.today.patients} icon={Users} />
            <StatCard label="Today's revenue" value={formatCurrency(d.today.revenue)} icon={IndianRupee} tone="success" />
            <StatCard
              label="Beds occupied"
              value={`${d.today.occupiedBeds} / ${d.today.totalBeds}`}
              icon={BedDouble}
              tone="warning"
              hint={`${d.today.totalBeds - d.today.occupiedBeds} not occupied`}
            />
            <StatCard label="Active doctors / staff" value={`${d.today.activeDoctors} / ${d.today.activeStaff}`} icon={Stethoscope} tone="teal" />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ChartCard
          title="Appointment outcomes, last 7 days"
          sample={a.isSample}
          table={d ? { columns: ["Day", "Completed", "Cancelled", "No-show"], rows: d.weekly.map((w) => [w.day, w.completed, w.cancelled, w.noShow]) } : undefined}
        >
          {!d ? (
            <ChartSkeleton />
          ) : (
            <TrendChart
              kind="bar"
              stacked
              data={d.weekly}
              xKey="day"
              series={[
                { key: "completed", label: "Completed", color: 1 },
                { key: "cancelled", label: "Cancelled", color: 3 },
                { key: "noShow", label: "No-show", color: 5 },
              ]}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Patients by department today"
          sample={a.isSample}
          table={d ? { columns: ["Department", "Patients"], rows: d.departments.map((x) => [x.name, x.patients]) } : undefined}
        >
          {!d ? <ChartSkeleton /> : <BarList items={d.departments.map((x) => ({ label: x.name, value: x.patients }))} />}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Revenue, last 14 days"
          className="lg:col-span-2"
          sample={a.isSample}
          table={d ? { columns: ["Date", "Revenue"], rows: d.revenueTrend.map((r) => [r.day, formatCurrency(r.revenue)]) } : undefined}
        >
          {!d ? <ChartSkeleton /> : <TrendChart kind="area" data={d.revenueTrend} xKey="day" series={[{ key: "revenue", label: "Revenue", color: 2 }]} format={(n) => `₹${formatCompact(n)}`} />}
        </ChartCard>

        <ChartCard
          title="Today's appointment status"
          sample={a.isSample}
          table={d ? { columns: ["Status", "Count"], rows: d.statusDistribution.map((s) => [appointmentStatusLabel(s.status), s.count]) } : undefined}
        >
          {!d ? <ChartSkeleton /> : <BarList items={d.statusDistribution.map((s) => ({ label: appointmentStatusLabel(s.status), value: s.count }))} />}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PackageX className="size-4 text-warning" aria-hidden /> Low-stock medicines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {batches.isLoading ? (
              <Skeleton className="h-32" />
            ) : low.length === 0 ? (
              <p className="text-sm text-muted-foreground">All medicines are above reorder level.</p>
            ) : (
              <ul className="grid gap-2">
                {low.map((m) => (
                  <li key={m.medicineId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    {m.name}
                    <Badge variant={m.quantity === 0 ? "danger" : "warning"}>
                      {m.quantity} / reorder {m.reorderLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/dashboard/hospital-admin/staff" className="text-sm font-medium text-primary hover:underline">
              Manage staff
            </Link>
          </CardHeader>
          <CardContent>
            {audit.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="grid gap-3">
                {activity.map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{x.actor}</span> <span className="text-muted-foreground">{x.action.toLowerCase().replaceAll("_", " ")}</span>
                      <span className="block text-xs text-muted-foreground">{x.entity}</span>
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

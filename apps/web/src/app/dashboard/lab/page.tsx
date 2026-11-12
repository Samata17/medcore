"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FlaskConical, TestTubes } from "lucide-react";
import { LAB_ORDER_STATUSES, hasAbnormal } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarList, ChartCard } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { LabStatusBadge, labStatusLabel } from "@/components/dashboard/status-badge";
import { useLabOrders } from "@/lib/hms";
import { formatRelative } from "@/lib/format";

export default function LabHome() {
  const orders = useLabOrders();
  const o = orders.data ?? [];
  const open = o.filter((x) => x.status !== "APPROVED" && x.status !== "CANCELLED");
  const queue = open.toSorted((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "URGENT" ? -1 : 1));
  const byStatus = LAB_ORDER_STATUSES.filter((s) => s !== "CANCELLED").map((s) => ({ label: labStatusLabel(s), value: o.filter((x) => x.status === s).length }));

  return (
    <>
      <PageHeader
        title="Laboratory"
        description="Incoming orders, sample collection, result entry and approval."
        sample={orders.isSample}
        actions={
          <Button asChild>
            <Link href="/dashboard/lab/orders">Open worklist</Link>
          </Button>
        }
      />
      <StatGrid className="mb-6">
        {orders.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="New orders" value={o.filter((x) => x.status === "ORDERED").length} icon={FlaskConical} />
            <StatCard label="In process" value={o.filter((x) => x.status === "SAMPLE_COLLECTED" || x.status === "PROCESSING").length} icon={TestTubes} tone="teal" />
            <StatCard label="Awaiting approval" value={o.filter((x) => x.status === "RESULT_ENTERED").length} icon={ClipboardCheck} tone="warning" />
            <StatCard label="Reports with abnormal values" value={o.filter((x) => hasAbnormal(x.results)).length} icon={AlertTriangle} tone="danger" />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Work queue</CardTitle>
            <CardDescription>Urgent orders first, then oldest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.isLoading ? (
              <Skeleton className="h-60" />
            ) : queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">The queue is empty.</p>
            ) : (
              <ul className="grid gap-2">
                {queue.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{x.testName}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.code} · {x.patientName} · {formatRelative(x.orderedAt)}
                      </p>
                    </div>
                    {x.priority === "URGENT" && <Badge variant="danger">Urgent</Badge>}
                    <LabStatusBadge status={x.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <ChartCard
          title="Orders by stage"
          sample={orders.isSample}
          className="h-fit"
          table={{ columns: ["Stage", "Orders"], rows: byStatus.map((b) => [b.label, b.value]) }}
        >
          {orders.isLoading ? <Skeleton className="h-48" /> : <BarList items={byStatus} />}
        </ChartCard>
      </div>
    </>
  );
}

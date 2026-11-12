"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, Package, PackageX, Pill } from "lucide-react";
import { daysToExpiry, isExpired, stockSummary } from "@medcore/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarList, ChartCard } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { EXPIRY_WARNING_DAYS, ExpiryBadge } from "@/components/modules/pharmacy/expiry-badge";
import { useBatches, usePrescriptions } from "@/lib/hms";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PharmacyHome() {
  const batches = useBatches();
  const rx = usePrescriptions();
  const b = useMemo(() => batches.data ?? [], [batches.data]);
  const summary = useMemo(() => stockSummary(b), [b]);
  const low = summary.filter((m) => m.low);
  const expiring = b.filter((x) => !isExpired(x) && daysToExpiry(x) <= EXPIRY_WARNING_DAYS && x.quantity > 0);
  const expired = b.filter((x) => isExpired(x) && x.quantity > 0);
  const pending = (rx.data ?? []).filter((r) => r.status === "ISSUED" || r.status === "PARTIALLY_DISPENSED");

  const valueByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of b) if (!isExpired(x)) m.set(x.category, (m.get(x.category) ?? 0) + x.quantity * x.unitCost);
    return [...m.entries()].map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, z) => z.value - a.value);
  }, [b]);

  return (
    <>
      <PageHeader
        title="Pharmacy"
        description="Stock levels, expiry tracking and prescriptions waiting to be dispensed."
        sample={batches.isSample}
        actions={
          <Button asChild>
            <Link href="/dashboard/pharmacy/prescriptions">Dispense prescriptions</Link>
          </Button>
        }
      />
      <StatGrid className="mb-6">
        {batches.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Prescriptions to dispense" value={pending.length} icon={Pill} />
            <StatCard label="Below reorder level" value={low.length} icon={PackageX} tone="warning" />
            <StatCard label={`Expiring in ${EXPIRY_WARNING_DAYS} days`} value={expiring.length} icon={CalendarClock} tone="warning" />
            <StatCard label="Expired batches (blocked)" value={expired.length} icon={Package} tone="danger" />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low-stock alerts</CardTitle>
            <CardDescription>Sellable stock (excluding expired batches) at or below reorder level.</CardDescription>
          </CardHeader>
          <CardContent>
            {batches.isLoading ? (
              <Skeleton className="h-40" />
            ) : low.length === 0 ? (
              <p className="text-sm text-muted-foreground">All medicines are above their reorder level.</p>
            ) : (
              <ul className="grid gap-2">
                {low.map((m) => (
                  <li key={m.medicineId} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">Reorder level {m.reorderLevel}</span>
                    </span>
                    <Badge variant={m.quantity === 0 ? "danger" : "warning"}>{m.quantity} left</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiry watch</CardTitle>
            <CardDescription>Expired batches can&apos;t be dispensed.</CardDescription>
          </CardHeader>
          <CardContent>
            {batches.isLoading ? (
              <Skeleton className="h-40" />
            ) : expired.length + expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batches expiring soon.</p>
            ) : (
              <ul className="grid gap-2">
                {[...expired, ...expiring].map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>
                      <span className="font-medium">{x.medicineName}</span>
                      <span className="block text-xs text-muted-foreground">
                        Batch {x.batchNo} · {x.quantity} units · exp {formatDate(x.expiresOn)}
                      </span>
                    </span>
                    <ExpiryBadge batch={x} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ChartCard
        className="mt-6"
        title="Inventory value by category"
        description="Unit cost × quantity of sellable stock"
        sample={batches.isSample}
        table={{ columns: ["Category", "Value (₹)"], rows: valueByCategory.map((v) => [v.label, formatCurrency(v.value)]) }}
      >
        {batches.isLoading ? <Skeleton className="h-40" /> : <BarList items={valueByCategory} format={(n) => formatCurrency(n)} />}
      </ChartCard>
    </>
  );
}

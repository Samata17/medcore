"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FileClock, IndianRupee, Receipt, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarList, ChartCard, ChartSkeleton, TrendChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { InvoiceStatusBadge } from "@/components/dashboard/status-badge";
import { useHospitalAnalytics } from "@/lib/analytics";
import { useClaims, useInvoices } from "@/lib/hms";
import { formatCompact, formatCurrency, formatDate } from "@/lib/format";

export default function AccountsHome() {
  const invoices = useInvoices();
  const claims = useClaims();
  const analytics = useHospitalAnalytics();
  const inv = useMemo(() => invoices.data ?? [], [invoices.data]);

  const collected = inv.reduce((s, i) => s + i.paid, 0);
  const outstanding = inv.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
  const outstandingAmt = outstanding.reduce((s, i) => s + (i.total - i.paid), 0);
  const pendingClaims = (claims.data ?? []).filter((c) => ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(c.status));

  /** Reconciliation: what each payment method collected vs. how many invoices used it. */
  const byMethod = useMemo(() => {
    const m = new Map<string, { amount: number; invoices: number }>();
    for (const i of inv) {
      if (!i.lastPaymentMethod || i.paid <= 0) continue;
      const cur = m.get(i.lastPaymentMethod) ?? { amount: 0, invoices: 0 };
      m.set(i.lastPaymentMethod, { amount: cur.amount + i.paid, invoices: cur.invoices + 1 });
    }
    return [...m.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount);
  }, [inv]);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Collections, outstanding balances, reconciliation and insurance claims."
        sample={invoices.isSample}
        actions={
          <Button asChild>
            <Link href="/dashboard/accounts/invoices">Manage invoices</Link>
          </Button>
        }
      />
      <StatGrid className="mb-6">
        {invoices.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Collected" value={formatCurrency(collected)} icon={IndianRupee} tone="success" />
            <StatCard label="Outstanding" value={formatCurrency(outstandingAmt)} icon={FileClock} tone="warning" hint={`${outstanding.length} invoices`} />
            <StatCard label="Invoices issued today" value={inv.filter((i) => new Date(i.issuedAt).toDateString() === new Date().toDateString()).length} icon={Receipt} />
            <StatCard label="Open insurance claims" value={pendingClaims.length} icon={ShieldCheck} tone="teal" />
          </>
        )}
      </StatGrid>

      <ChartCard
        title="Daily revenue (last 14 days)"
        sample={analytics.isSample}
        table={analytics.data ? { columns: ["Date", "Revenue"], rows: analytics.data.revenueTrend.map((r) => [r.day, formatCurrency(r.revenue)]) } : undefined}
      >
        {analytics.isLoading || !analytics.data ? (
          <ChartSkeleton />
        ) : (
          <TrendChart kind="area" data={analytics.data.revenueTrend} xKey="day" series={[{ key: "revenue", label: "Revenue" }]} format={(n) => `₹${formatCompact(n)}`} />
        )}
      </ChartCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment reconciliation</CardTitle>
            <CardDescription>Collections by method — match these against the cash drawer, card terminal and UPI settlement reports.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell>{m.method}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.invoices}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(m.amount, true)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{byMethod.reduce((s, m) => s + m.invoices, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(collected, true)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Largest outstanding balances</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <Skeleton className="h-40" />
            ) : outstanding.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
            ) : (
              <BarList
                items={outstanding
                  .map((i) => ({ label: `${i.number} · ${i.patientName}`, value: Math.round(i.total - i.paid) }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 6)}
                format={(n) => formatCurrency(n)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="divide-y">
              {inv.slice(0, 5).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-medium">{i.number}</span>
                    <span className="block text-xs text-muted-foreground">
                      {i.patientName} · {formatDate(i.issuedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatCurrency(i.total, true)}</span>
                    <InvoiceStatusBadge status={i.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

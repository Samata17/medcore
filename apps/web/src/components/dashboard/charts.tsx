"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SampleDataBadge } from "@/components/dashboard/sample-data-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ---------- Chart card with accessible table view ---------- */

export function ChartCard({
  title,
  description,
  sample,
  table,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  sample?: boolean;
  /** Same data as rows/columns; shown via the "Table" toggle for screen readers & precise reading. */
  table?: { columns: string[]; rows: (string | number)[][] };
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {sample && <SampleDataBadge />}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              aria-label={asTable ? `Show ${title} as chart` : `Show ${title} as table`}
            >
              {asTable ? <BarChart3 /> : <Table2 />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {asTable && table ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r, i) => (
                  <TableRow key={i}>
                    {r.map((v, j) => (
                      <TableCell key={j} className={j > 0 ? "tabular-nums" : undefined}>
                        {v}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Trend chart (bar / line / area) ---------- */

export interface Series {
  key: string;
  label: string;
  /** Categorical slot 1-5, assigned in fixed order per entity. */
  color?: 1 | 2 | 3 | 4 | 5;
}

const colorVar = (s: Series, i: number) => `var(--chart-${s.color ?? i + 1})`;

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: Partial<TooltipContentProps<number, string>> & { format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: colorVar(s, i) }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  kind = "bar",
  format = (n) => n.toLocaleString("en-IN"),
  height = 260,
  stacked = false,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  kind?: "bar" | "line" | "area";
  format?: (n: number) => string;
  height?: number;
  stacked?: boolean;
}) {
  const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
      <XAxis dataKey={xKey} {...axis} tickMargin={8} />
      <YAxis {...axis} width={48} tickFormatter={(v) => format(Number(v))} />
      <Tooltip
        cursor={kind === "bar" ? { fill: "var(--muted)", opacity: 0.6 } : { stroke: "var(--muted-foreground)", strokeWidth: 1 }}
        content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />}
      />
    </>
  );

  return (
    <div>
      <Legend series={series} />
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data} barCategoryGap="28%" barGap={2}>
              {common}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={colorVar(s, i)}
                  stackId={stacked ? "a" : undefined}
                  radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                  stroke={stacked ? "var(--card)" : undefined}
                  strokeWidth={stacked ? 2 : 0}
                  maxBarSize={36}
                />
              ))}
            </BarChart>
          ) : kind === "line" ? (
            <LineChart data={data}>
              {common}
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="monotone"
                  stroke={colorVar(s, i)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4.5, stroke: "var(--card)", strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data}>
              {common}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="monotone"
                  stroke={colorVar(s, i)}
                  strokeWidth={2}
                  fill={colorVar(s, i)}
                  fillOpacity={0.12}
                  activeDot={{ r: 4.5, stroke: "var(--card)", strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- Horizontal bar list (single hue, magnitude) ---------- */

export function BarList({
  items,
  format = (n) => n.toLocaleString("en-IN"),
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-3">
      {items.map((it) => (
        <li key={it.label} className="grid gap-1.5" title={`${it.label}: ${format(it.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format(it.value)}
              {it.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{it.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton style={{ height }} className="w-full" />;
}

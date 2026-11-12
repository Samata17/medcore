import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-info-soft text-primary",
  teal: "bg-teal-soft text-teal",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
} as const;

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  /** Percent change vs previous period; positive = up. */
  change?: number;
  /** Set when "up" is bad (e.g. cancellations). */
  invertChange?: boolean;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, tone = "primary", change, invertChange, hint }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  const good = invertChange ? !up : up;
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="size-[1.1rem]" aria-hidden />
        </span>
      </div>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {change !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {Math.abs(change)}%
            <span className="sr-only">{up ? "increase" : "decrease"}</span>
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-3 p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-32" />
    </Card>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CreditCard,
  FlaskConical,
  Info,
  PackageX,
  Pill,
  Receipt,
  Siren,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem, NotificationType } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  APPOINTMENT_CONFIRMED: { icon: CalendarCheck, tone: "bg-info-soft text-primary" },
  APPOINTMENT_REMINDER: { icon: CalendarCheck, tone: "bg-teal-soft text-teal" },
  LAB_REPORT_APPROVED: { icon: FlaskConical, tone: "bg-teal-soft text-teal" },
  PRESCRIPTION_READY: { icon: Pill, tone: "bg-info-soft text-primary" },
  INVOICE_ISSUED: { icon: Receipt, tone: "bg-secondary text-secondary-foreground" },
  PAYMENT_RECEIVED: { icon: CreditCard, tone: "bg-success-soft text-success" },
  LOW_STOCK: { icon: PackageX, tone: "bg-warning-soft text-warning" },
  EMERGENCY_APPOINTMENT: { icon: Siren, tone: "bg-destructive-soft text-destructive" },
  SYSTEM: { icon: Info, tone: "bg-secondary text-secondary-foreground" },
};

export function NotificationRow({ n, onRead }: { n: NotificationItem; onRead?: (id: string) => void }) {
  const meta = NOTIFICATION_META[n.type];
  const router = useRouter();
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (!n.read) onRead?.(n.id);
          if (n.href) router.push(n.href);
        }}
        className={cn(
          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
          !n.read && "bg-accent/40",
        )}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tone)}>
          <meta.icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{n.title}</span>
            {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}

export function NotificationCenter() {
  const { data, isLoading, isError, unread, markRead, refetch } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="size-[1.15rem]" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          <Button variant="link" size="sm" className="h-auto p-0" disabled={!unread} onClick={() => markRead.mutate(undefined)}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm">
              <AlertTriangle className="size-5 text-warning" aria-hidden />
              <p className="text-muted-foreground">Couldn&apos;t load notifications.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : !data?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y">
              {data.slice(0, 6).map((n) => (
                <NotificationRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/dashboard/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

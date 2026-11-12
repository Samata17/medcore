"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AppointmentRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/dashboard/status-badge";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const key = (d: Date) => d.toDateString();

/** Month calendar with a per-day count, plus the selected day's appointments. */
export function AppointmentCalendar({ appointments }: { appointments: AppointmentRow[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selected, setSelected] = useState(() => key(new Date()));

  const byDay = useMemo(() => {
    const m = new Map<string, AppointmentRow[]>();
    for (const a of appointments) {
      const k = key(new Date(a.startsAt));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [appointments]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const today = key(new Date());
  const list = (byDay.get(selected) ?? []).toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label="Appointment calendar">
          {cells.map((d) => {
            const k = key(d);
            const count = byDay.get(k)?.length ?? 0;
            const inMonth = d.getMonth() === month.getMonth();
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-pressed={selected === k}
                aria-label={`${d.toDateString()}, ${count} appointment${count === 1 ? "" : "s"}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  inMonth ? "" : "text-muted-foreground/50",
                  selected === k ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  today === k && selected !== k && "font-bold text-primary",
                )}
              >
                {d.getDate()}
                <span className={cn("h-1.5 min-w-1.5 rounded-full", count ? (selected === k ? "bg-primary-foreground" : "bg-teal") : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-3 font-medium">{new Date(selected).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No appointments on this day.</p>
        ) : (
          <ul className="grid gap-2">
            {list.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <span className="w-16 shrink-0 font-medium tabular-nums">{formatTime(a.startsAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.patientName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.reason}</span>
                </span>
                <AppointmentStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

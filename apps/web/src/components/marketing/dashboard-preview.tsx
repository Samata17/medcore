import {
  Activity,
  BedDouble,
  CalendarCheck,
  FlaskConical,
  IndianRupee,
  LayoutDashboard,
  Pill,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A static, illustrative preview of the hospital admin dashboard.
 * Every number here is SAMPLE DATA and is labeled as such on screen.
 */
const STATS = [
  { label: "Today's patients", value: "142", icon: Users, tone: "text-primary bg-info-soft" },
  { label: "Revenue today", value: "₹3.8L", icon: IndianRupee, tone: "text-teal bg-teal-soft" },
  { label: "Beds occupied", value: "86/120", icon: BedDouble, tone: "text-warning bg-warning-soft" },
];

const WEEK = [
  { d: "Mon", v: 62 },
  { d: "Tue", v: 78 },
  { d: "Wed", v: 71 },
  { d: "Thu", v: 90 },
  { d: "Fri", v: 84 },
  { d: "Sat", v: 55 },
  { d: "Sun", v: 38 },
];

const QUEUE = [
  { time: "09:30", name: "A. Kulkarni", dept: "Cardiology", status: "In progress", variant: "info" as const },
  { time: "09:45", name: "R. Menon", dept: "Orthopedics", status: "Confirmed", variant: "teal" as const },
  { time: "10:00", name: "S. Iyer", dept: "Emergency", status: "Emergency", variant: "danger" as const },
  { time: "10:15", name: "P. Das", dept: "General", status: "Checked in", variant: "success" as const },
];

const NAV = [LayoutDashboard, CalendarCheck, Stethoscope, FlaskConical, Pill, Receipt];

export function DashboardPreview() {
  const max = Math.max(...WEEK.map((w) => w.v));
  return (
    <div
      role="img"
      aria-label="Preview of the MedCore hospital admin dashboard showing sample statistics, a weekly appointments chart and today's queue"
      className="relative overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-20px_rgba(11,79,156,0.25)]"
    >
      {/* window chrome */}
      <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <Badge variant="warning" className="text-[10px]">
          Sample data
        </Badge>
      </div>

      <div className="flex">
        {/* mini sidebar */}
        <div className="hidden w-12 flex-col items-center gap-3 border-r py-4 sm:flex" aria-hidden>
          {NAV.map((Icon, i) => (
            <span
              key={i}
              className={
                i === 0
                  ? "grid size-8 place-items-center rounded-lg bg-accent text-primary"
                  : "grid size-8 place-items-center rounded-lg text-muted-foreground"
              }
            >
              <Icon className="size-4" />
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Sunrise General Hospital</p>
              <p className="font-display text-sm font-semibold">Hospital overview</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-success">
              <Activity className="size-3" /> Live
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border p-2.5">
                <span className={`mb-2 grid size-7 place-items-center rounded-lg ${s.tone}`}>
                  <s.icon className="size-3.5" />
                </span>
                <p className="font-display text-base leading-none font-semibold">{s.value}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2.5 md:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border p-3">
              <p className="mb-3 text-[11px] font-medium">Appointments this week</p>
              <div className="flex h-24 items-end gap-1.5">
                {WEEK.map((w) => (
                  <div key={w.d} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-[4px] bg-primary/85"
                      style={{ height: `${(w.v / max) * 100}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{w.d}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-2 text-[11px] font-medium">Today&apos;s queue</p>
              <ul className="space-y-2">
                {QUEUE.map((q) => (
                  <li key={q.time} className="flex items-center gap-2 text-[11px]">
                    <span className="w-9 shrink-0 text-muted-foreground tabular-nums">{q.time}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{q.name}</span>
                      <span className="text-muted-foreground"> · {q.dept}</span>
                    </span>
                    <Badge variant={q.variant} className="px-1.5 text-[9px]">
                      {q.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

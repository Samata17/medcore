import { CalendarCheck, FlaskConical, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const POINTS = [
  { icon: CalendarCheck, text: "Book and manage appointments online" },
  { icon: FlaskConical, text: "View approved lab reports and prescriptions" },
  { icon: ShieldCheck, text: "Your records are visible only to you and your care team" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-teal/30 blur-3xl" aria-hidden />
        <Logo inverted className="relative" />
        <div className="relative my-auto max-w-md">
          <h2 className="text-3xl leading-tight font-bold">Your hospital, connected.</h2>
          <p className="mt-3 text-primary-foreground/80">
            One secure account for patients and every member of the hospital team.
          </p>
          <ul className="mt-10 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm">
                <span className="grid size-9 place-items-center rounded-lg bg-primary-foreground/10">
                  <p.icon className="size-4" aria-hidden />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/60">Academic project · Fictional demo data only</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

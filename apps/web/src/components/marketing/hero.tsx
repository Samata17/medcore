import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/fade-in";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";

const POINTS = ["Nine role-based workspaces", "Isolated data for every hospital", "Append-only medical records"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
      <div className="container-page relative grid items-center gap-12 pt-14 pb-16 lg:grid-cols-[1fr_1.1fr] lg:pt-20 lg:pb-24">
        <FadeIn>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-teal" aria-hidden />
            Hospital management platform
          </p>
          <h1 className="text-4xl leading-[1.08] font-bold text-balance sm:text-5xl lg:text-[3.4rem]">
            Run every ward, clinic and counter from <span className="text-primary">one connected system</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            MedCore HMS brings registration, appointments, medical records, prescriptions, lab, pharmacy and billing
            together — so staff spend less time on paperwork and more time with patients.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Register as a patient <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Onboard your hospital</Link>
            </Button>
          </div>

          <ul className="mt-8 grid gap-2.5 sm:grid-cols-1">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-teal" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.1}>
          <DashboardPreview />
        </FadeIn>
      </div>
    </section>
  );
}

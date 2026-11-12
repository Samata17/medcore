import type { Metadata } from "next";
import Link from "next/link";
import { Database, Layers, Server, Target, Users, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";

export const metadata: Metadata = {
  title: "About",
  description: "Why MedCore HMS exists and how it is built.",
};

const PRINCIPLES = [
  {
    icon: Target,
    title: "One record per patient",
    body: "Registration, consultations, lab, pharmacy and billing all read from the same patient record.",
  },
  {
    icon: Users,
    title: "Designed per role",
    body: "Each of the nine roles sees the tasks it actually performs — nothing more.",
  },
  {
    icon: Workflow,
    title: "Honest data",
    body: "Dashboards show live database figures. Demo screens are clearly marked as sample data.",
  },
];

const STACK = [
  {
    icon: Layers,
    title: "Frontend",
    items: ["Next.js 15 (App Router)", "React 19 & TypeScript", "Tailwind CSS & shadcn/ui", "TanStack Query, Zustand, Recharts"],
  },
  {
    icon: Server,
    title: "Backend",
    items: ["NestJS & TypeScript", "JWT with refresh-token rotation", "Socket.IO notifications", "Swagger API docs"],
  },
  {
    icon: Database,
    title: "Data & infrastructure",
    items: ["PostgreSQL 16 with Prisma", "Redis 7", "Docker Compose", "GitHub Actions CI"],
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b bg-card">
        <div className="container-page py-16 lg:py-20">
          <p className="mb-3 text-sm font-semibold tracking-wide text-teal uppercase">About MedCore</p>
          <h1 className="max-w-3xl text-4xl font-bold text-balance sm:text-5xl">
            Hospital software that follows the patient, not the department
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Many hospitals still move information between paper files, spreadsheets and separate systems for each
            department. MedCore HMS is a multi-hospital platform that connects those steps into one workflow, while
            keeping each hospital&apos;s data strictly separate.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Principles" title="What guides the design" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-2xl border bg-card p-6">
                <p.icon className="size-6 text-primary" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-card py-16 lg:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Architecture"
            title="How MedCore is built"
            description="A TypeScript monorepo with a Next.js frontend, a NestJS API and a shared types package."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STACK.map((s) => (
              <div key={s.title} className="rounded-2xl border bg-background p-6">
                <s.icon className="size-6 text-teal" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {s.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container-page flex flex-col items-start gap-6 rounded-2xl border bg-card p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">An academic full-stack project</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              MedCore HMS was built as an MCA full-stack development project. It is not intended for clinical use, and
              all demo data is fictional.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/contact">Get in touch</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

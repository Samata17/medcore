"use client";

import {
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardPlus,
  FlaskConical,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/marketing/section-heading";

const ROLES = [
  {
    id: "admin",
    label: "Administration",
    icon: Building2,
    title: "Super Admin & Hospital Admin",
    body: "Platform owners onboard and verify hospitals and manage subscriptions. Hospital admins configure departments, beds and staff and monitor daily operations.",
    points: ["Hospital onboarding & verification", "Bed occupancy and department statistics", "Staff management and activity logs", "Low-stock and revenue overview"],
  },
  {
    id: "clinical",
    label: "Clinical",
    icon: Stethoscope,
    title: "Doctors & Nurses",
    body: "Doctors see their day as a timeline and open a patient encounter in one click. Nurses record vitals and medication notes for their assigned ward.",
    points: ["Appointment timeline and follow-up calendar", "Vitals, diagnoses and treatment plans", "Prescriptions and lab orders from the encounter", "Ward and medication administration notes"],
  },
  {
    id: "front",
    label: "Front desk",
    icon: ClipboardPlus,
    title: "Receptionists",
    body: "Register walk-in patients, find existing records, book or reschedule appointments and check patients in as they arrive.",
    points: ["Fast patient search and registration", "Slot-aware booking with no double-booking", "Check-in and status updates", "Invoice generation at the counter"],
  },
  {
    id: "diagnostics",
    label: "Lab & Pharmacy",
    icon: FlaskConical,
    title: "Lab Technicians & Pharmacists",
    body: "Lab staff move orders from sample collection to approved report. Pharmacists fulfil prescriptions from the oldest valid batch first.",
    points: ["Sample status and structured result entry", "Approval before patients can view reports", "Batch, expiry and reorder tracking", "FIFO dispensing with expired-stock blocks"],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Calculator,
    title: "Accountants",
    body: "Track every invoice from issue to payment, reconcile collections and manage insurance claims in a single view.",
    points: ["Consultation, lab, pharmacy and room charges", "Payment reconciliation", "Revenue reports", "Insurance claim workflow"],
  },
  {
    id: "patient",
    label: "Patients",
    icon: UserRound,
    title: "Patient portal",
    body: "Patients book appointments, view approved reports and prescriptions, and pay invoices — and can only ever see their own records.",
    points: ["Book with any available doctor", "Medical records and prescriptions", "Lab reports after approval", "Invoices and payment status"],
  },
];

export function Solutions() {
  return (
    <section id="solutions" aria-labelledby="solutions-title" className="scroll-mt-20 py-20 lg:py-24">
      <div className="container-page">
        <SectionHeading
          id="solutions-title"
          eyebrow="Hospital solutions"
          title="A focused workspace for every role"
          description="Nine roles, each with its own dashboard and permissions enforced by the server — not just hidden menu items."
        />

        <Tabs defaultValue="admin" className="mt-12 items-center">
          <div className="w-full overflow-x-auto pb-1 sm:flex sm:justify-center">
            <TabsList>
              {ROLES.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  <r.icon aria-hidden /> {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {ROLES.map((r) => (
            <TabsContent key={r.id} value={r.id} className="mt-6 w-full">
              <div className="grid gap-8 rounded-2xl border bg-card p-6 sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
                <div>
                  <span className="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-primary">
                    <r.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-2xl font-bold">{r.title}</h3>
                  <p className="mt-3 text-muted-foreground">{r.body}</p>
                </div>
                <ul className="grid gap-3">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

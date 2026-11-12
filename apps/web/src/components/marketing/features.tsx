import {
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Receipt,
} from "lucide-react";
import { FadeIn } from "@/components/fade-in";
import { SectionHeading } from "@/components/marketing/section-heading";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Appointments",
    body: "Doctor availability, configurable slots, double-booking prevention, emergency flags and reminders.",
  },
  {
    icon: ClipboardList,
    title: "Electronic medical records",
    body: "Vitals with automatic BMI, diagnoses, allergies, vaccinations and history — corrections are audited, never erased.",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    body: "Searchable medicine list, dosage, frequency and duration, with printable and PDF prescriptions.",
  },
  {
    icon: FlaskConical,
    title: "Laboratory",
    body: "Test orders, sample tracking, structured results, approval before release and out-of-range flags.",
  },
  {
    icon: Pill,
    title: "Pharmacy",
    body: "Batch and expiry tracking, reorder levels, first-in first-out dispensing and stock movement history.",
  },
  {
    icon: Receipt,
    title: "Billing & payments",
    body: "Itemised invoices with taxes, cash and test-mode online payments, verified on the server.",
  },
  {
    icon: Bell,
    title: "Real-time notifications",
    body: "Appointment, lab report, prescription, invoice and low-stock alerts delivered in-app instantly.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Appointment trends, revenue, patient growth and department statistics from live database queries.",
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-y bg-card py-20 lg:py-24">
      <div className="container-page">
        <SectionHeading
          id="features-title"
          eyebrow="Core modules"
          title="Everything a hospital runs on, in one place"
          description="Each module shares the same patient record, so information entered once is available wherever it is needed."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={(i % 4) * 0.05} className="bg-card p-6">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-accent text-primary">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

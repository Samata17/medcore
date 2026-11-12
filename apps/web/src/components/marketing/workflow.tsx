import { CalendarCheck, ClipboardList, FileSignature, Receipt, UserPlus } from "lucide-react";
import { FadeIn } from "@/components/fade-in";
import { SectionHeading } from "@/components/marketing/section-heading";

const STEPS = [
  { icon: UserPlus, title: "Register", body: "Front desk or the patient creates a verified record." },
  { icon: CalendarCheck, title: "Book", body: "A free slot is reserved with the right doctor." },
  { icon: ClipboardList, title: "Consult", body: "The doctor records vitals, diagnosis and a plan." },
  { icon: FileSignature, title: "Order", body: "Prescriptions go to pharmacy, tests go to the lab." },
  { icon: Receipt, title: "Bill", body: "Charges collect on one invoice, paid and verified." },
];

export function Workflow() {
  return (
    <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-20 border-y bg-card py-20 lg:py-24">
      <div className="container-page">
        <SectionHeading
          id="workflow-title"
          eyebrow="Patient journey"
          title="From front desk to final invoice"
          description="Every step hands information to the next, so nothing is typed twice."
        />
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.06}>
              <li className="relative h-full list-none">
                {i < STEPS.length - 1 && (
                  <span className="absolute top-6 left-14 hidden h-px w-[calc(100%-3rem)] bg-border lg:block" aria-hidden />
                )}
                <span className="relative grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">Step {i + 1}</p>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </li>
            </FadeIn>
          ))}
        </ol>
      </div>
    </section>
  );
}

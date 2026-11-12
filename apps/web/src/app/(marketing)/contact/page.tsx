import type { Metadata } from "next";
import { Building2, Clock, LifeBuoy } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Request hospital onboarding or ask a question about MedCore HMS.",
};

const INFO = [
  {
    icon: Building2,
    title: "Hospital onboarding",
    body: "Share your hospital name, number of departments and beds, and we'll prepare a workspace for verification.",
  },
  {
    icon: LifeBuoy,
    title: "Support",
    body: "Existing users can describe the issue and the page where it happened. Never include patient details.",
  },
  {
    icon: Clock,
    title: "Response time",
    body: "We aim to reply within two working days.",
  },
];

export default function ContactPage() {
  return (
    <section className="py-16 lg:py-20">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="mb-3 text-sm font-semibold tracking-wide text-teal uppercase">Contact</p>
          <h1 className="text-4xl font-bold text-balance">Let&apos;s talk about your hospital</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Use this form for onboarding requests and product questions.
          </p>
          <ul className="mt-10 space-y-6">
            {INFO.map((i) => (
              <li key={i.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <i.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-semibold">{i.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{i.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}

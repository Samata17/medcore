import { Building2, FileClock, KeyRound, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";

const ITEMS = [
  {
    icon: Building2,
    title: "Tenant isolation",
    body: "Every record is scoped to its hospital. Staff of one hospital cannot query another hospital's data.",
  },
  {
    icon: ShieldCheck,
    title: "Server-side permissions",
    body: "Role checks run on every protected API endpoint. Patients can only reach their own records and invoices.",
  },
  {
    icon: KeyRound,
    title: "Secure sign-in",
    body: "Passwords hashed with bcrypt, short-lived access tokens and rotating refresh tokens in HTTP-only cookies.",
  },
  {
    icon: FileClock,
    title: "Append-only records",
    body: "Medical records are never silently overwritten. Corrections are stored as new, traceable entries.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    body: "Sign-ins, record access and changes are logged with who, what and when.",
  },
  {
    icon: Lock,
    title: "Hardened by default",
    body: "Input validation, rate limiting, strict CORS, secure headers and file-upload checks.",
  },
];

export function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="scroll-mt-20 py-20 lg:py-24">
      <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            id="security-title"
            align="left"
            eyebrow="Security & privacy"
            title="Built around protecting patient data"
            description="MedCore is designed with healthcare privacy principles in mind. Controls are documented so they can be reviewed."
          />
          <p className="mt-6 rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> MedCore HMS is an academic project. It has not been
            certified under HIPAA, DISHA or any other regulation. Use fictional data only.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map((it) => (
            <div key={it.title} className="rounded-2xl border bg-card p-5">
              <it.icon className="size-5 text-teal" aria-hidden />
              <h3 className="mt-3 font-semibold">{it.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

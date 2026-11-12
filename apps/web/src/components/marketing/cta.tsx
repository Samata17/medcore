import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="pb-20 lg:pb-24">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
          <div
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-teal/30 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
            <div>
              <h2 className="text-3xl font-bold text-balance sm:text-4xl">Ready to bring your hospital online?</h2>
              <p className="mt-3 max-w-xl text-primary-foreground/80">
                Tell us about your hospital and we&apos;ll set up an onboarding workspace. Patients can register
                straight away.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Button asChild size="lg" variant="secondary">
                <Link href="/contact">
                  Request onboarding <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

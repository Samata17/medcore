import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Solutions } from "@/components/marketing/solutions";
import { Workflow } from "@/components/marketing/workflow";
import { Security } from "@/components/marketing/security";
import { Cta } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Solutions />
      <Workflow />
      <Security />
      <Cta />
    </>
  );
}

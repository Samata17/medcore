import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { DemoRolePicker } from "@/components/auth/demo-role-picker";

export const metadata: Metadata = { title: "Explore the demo" };

export default function DemoPage() {
  return (
    <>
      <AuthHeading
        title="Explore with sample data"
        description="Pick a role to open its dashboard. Everything you see is fictional and nothing is saved to a server."
      />
      <DemoRolePicker />
    </>
  );
}

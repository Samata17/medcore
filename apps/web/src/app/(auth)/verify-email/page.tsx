import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  return (
    <>
      <AuthHeading
        title="Verify your email"
        description="Enter the 6-digit code we sent to your email address."
      />
      <VerifyEmailForm initialEmail={email} />
    </>
  );
}

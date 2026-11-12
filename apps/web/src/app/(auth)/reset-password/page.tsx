import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  return (
    <>
      <AuthHeading title="Set a new password" description="Enter the code from your email and choose a new password." />
      <ResetPasswordForm initialEmail={email} />
    </>
  );
}

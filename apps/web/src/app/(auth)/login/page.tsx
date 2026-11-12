import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Log in to MedCore" description="Patients and hospital staff use the same sign-in." />
      <LoginForm />
    </>
  );
}

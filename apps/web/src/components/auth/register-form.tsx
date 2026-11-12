"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { NativeSelect } from "@/components/ui/native-select";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { authApi } from "@/lib/auth-api";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";

export function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      hospitalId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const signup = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ email }) => {
      toast.success("Account created. Check your email for the verification code.");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const hospitals = useQuery({ queryKey: ["public-hospitals"], queryFn: authApi.publicHospitals, retry: false });

  return (
    <form onSubmit={handleSubmit((v) => signup.mutate(v))} noValidate className="grid gap-5">
      {signup.isError && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{signup.error.message}</span>
        </div>
      )}

      <FormField
        id="hospitalId"
        label="Hospital"
        required
        error={errors.hospitalId?.message ?? (hospitals.isError ? hospitals.error.message : undefined)}
        hint="Your records are kept by the hospital you choose."
      >
        {(aria) => (
          <NativeSelect {...aria} disabled={hospitals.isLoading || hospitals.isError} {...register("hospitalId")}>
            <option value="">{hospitals.isLoading ? "Loading hospitals…" : "Select a hospital…"}</option>
            {(hospitals.data ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.city ? ` · ${h.city}` : ""}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="firstName" label="First name" required error={errors.firstName?.message}>
          {(aria) => <Input {...aria} autoComplete="given-name" {...register("firstName")} />}
        </FormField>
        <FormField id="lastName" label="Last name" required error={errors.lastName?.message}>
          {(aria) => <Input {...aria} autoComplete="family-name" {...register("lastName")} />}
        </FormField>
      </div>

      <FormField id="email" label="Email" required error={errors.email?.message}>
        {(aria) => <Input {...aria} type="email" autoComplete="email" {...register("email")} />}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="phone" label="Mobile number" required error={errors.phone?.message}>
          {(aria) => <Input {...aria} type="tel" autoComplete="tel" placeholder="+919876543210" {...register("phone")} />}
        </FormField>
        <FormField id="dateOfBirth" label="Date of birth" required error={errors.dateOfBirth?.message}>
          {(aria) => <Input {...aria} type="date" max={today} autoComplete="bday" {...register("dateOfBirth")} />}
        </FormField>
      </div>

      <FormField
        id="password"
        label="Password"
        required
        error={errors.password?.message}
        hint="At least 8 characters with uppercase, lowercase and a number."
      >
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("password")} />}
      </FormField>

      <FormField id="confirmPassword" label="Confirm password" required error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("confirmPassword")} />}
      </FormField>

      <div className="grid gap-1.5">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-input accent-[var(--primary)]"
            aria-invalid={Boolean(errors.acceptTerms)}
            {...register("acceptTerms")}
          />
          <span className="text-muted-foreground">
            I agree to the terms of use and consent to my health information being processed by my care providers.
          </span>
        </label>
        {errors.acceptTerms && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.acceptTerms.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={signup.isPending}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

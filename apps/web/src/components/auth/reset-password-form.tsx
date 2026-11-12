"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { authApi } from "@/lib/auth-api";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: initialEmail, otp: "", password: "", confirmPassword: "" },
  });

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success("Password updated. Please log in with your new password.");
      router.push("/login");
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => reset.mutate(v))} noValidate className="grid gap-5">
      {reset.isError && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{reset.error.message}</span>
        </div>
      )}
      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} type="email" autoComplete="email" {...register("email")} />}
      </FormField>
      <FormField id="otp" label="Reset code" error={errors.otp?.message}>
        {(aria) => (
          <Input
            {...aria}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="font-mono tracking-[0.3em]"
            {...register("otp")}
          />
        )}
      </FormField>
      <FormField
        id="password"
        label="New password"
        error={errors.password?.message}
        hint="At least 8 characters with uppercase, lowercase and a number."
      >
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("password")} />}
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" size="lg" loading={reset.isPending}>
        Update password
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground">
        Didn&apos;t get a code? Request a new one
      </Link>
    </form>
  );
}

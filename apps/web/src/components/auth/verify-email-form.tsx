"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { authApi } from "@/lib/auth-api";
import { verifyEmailSchema, type VerifyEmailInput } from "@/lib/validators/auth";

const RESEND_COOLDOWN = 60;

export function VerifyEmailForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: initialEmail, otp: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      toast.success("Email verified. You can now log in.");
      router.push("/login");
    },
  });

  const resend = useMutation({
    mutationFn: authApi.resendOtp,
    onSuccess: () => {
      toast.success("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN);
    },
    onError: (err) => toast.error(err.message),
  });

  async function onResend() {
    if (await trigger("email")) resend.mutate(getValues("email"));
  }

  return (
    <form onSubmit={handleSubmit((v) => verify.mutate(v))} noValidate className="grid gap-5">
      {verify.isError && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{verify.error.message}</span>
        </div>
      )}

      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} type="email" autoComplete="email" {...register("email")} />}
      </FormField>

      <FormField id="otp" label="Verification code" error={errors.otp?.message} hint="The code expires after 10 minutes.">
        {(aria) => (
          <Input
            {...aria}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            className="h-12 text-center font-mono text-xl tracking-[0.5em]"
            {...register("otp")}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" loading={verify.isPending}>
        Verify email
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="link" className="h-auto p-0" disabled={cooldown > 0} loading={resend.isPending} onClick={onResend}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Back to log in
        </Link>
      </div>
    </form>
  );
}

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
import { authApi } from "@/lib/auth-api";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const request = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_data, { email }) => {
      // The API responds the same way whether or not the account exists.
      toast.success("If an account exists for that email, a reset code has been sent.");
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => request.mutate(v))} noValidate className="grid gap-5">
      {request.isError && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{request.error.message}</span>
        </div>
      )}
      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} type="email" autoComplete="email" {...register("email")} />}
      </FormField>
      <Button type="submit" size="lg" loading={request.isPending}>
        Send reset code
      </Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
        Back to log in
      </Link>
    </form>
  );
}

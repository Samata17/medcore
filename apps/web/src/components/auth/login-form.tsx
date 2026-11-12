"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ROLE_HOME } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { authApi } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { useAuthStore } from "@/stores/auth-store";
import { clearDemoRole } from "@/lib/demo/session";

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, accessToken }) => {
      clearDemoRole(); // a real sign-in replaces any demo session in this tab
      setSession(user, accessToken);
      toast.success(`Welcome back, ${user.firstName}`);
      // Role-based redirect after login
      router.push(ROLE_HOME[user.role]);
    },
    onError: (err) => {
      // Unverified accounts are sent to the OTP screen
      if (err instanceof ApiError && err.statusCode === 403 && /verify/i.test(err.message)) {
        router.push(`/verify-email?email=${encodeURIComponent(getValues("email"))}`);
      }
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => login.mutate(v))} noValidate className="grid gap-5">
      {login.isError && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{login.error.message}</span>
        </div>
      )}

      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />}
      </FormField>

      <div className="grid gap-2">
        <FormField id="password" label="Password" error={errors.password?.message}>
          {(aria) => <PasswordInput {...aria} autoComplete="current-password" {...register("password")} />}
        </FormField>
        <Link href="/forgot-password" className="justify-self-end text-xs font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={login.isPending}>
        Log in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New patient?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Hospital staff accounts are created by your hospital administrator.
      </p>

      <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border">
        <span className="relative bg-background px-2">or</span>
      </div>
      <Button asChild variant="outline">
        <Link href="/demo">Explore a role with sample data</Link>
      </Button>
    </form>
  );
}

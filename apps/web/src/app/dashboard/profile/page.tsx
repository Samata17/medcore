"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Info, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@medcore/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { useCurrentUser } from "@/hooks/use-session";
import { authApi } from "@/lib/auth-api";
import { profileSchema, type ProfileInput } from "@/lib/validators/profile";
import { useAuthStore } from "@/stores/auth-store";

export default function ProfilePage() {
  const user = useCurrentUser();
  const mode = useAuthStore((s) => s.mode);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const isDemo = mode === "demo";

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  // Live mode: load the saved phone & address so the form starts filled in.
  const me = useQuery({ queryKey: ["me", user.id], queryFn: authApi.me, enabled: mode === "live" });
  useEffect(() => {
    if (!me.data) return;
    reset({
      firstName: me.data.firstName,
      lastName: me.data.lastName,
      phone: me.data.phone ?? "",
      addressLine1: me.data.address?.line1 ?? "",
      city: me.data.address?.city ?? "",
      state: me.data.address?.state ?? "",
      postalCode: me.data.address?.postalCode ?? "",
    });
  }, [me.data, reset]);

  const save = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (updated, values) => {
      if (accessToken) setSession(updated, accessToken);
      reset(values);
      toast.success("Profile saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <PageHeader title="Profile" description="Your personal details and contact address." />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit items-center p-6 text-center">
          <Avatar name={fullName} className="size-20 text-xl" />
          <div>
            <p className="font-display text-lg font-semibold">{fullName}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="grid w-full gap-2 text-left text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{user.email}</span>
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              {user.emailVerified ? "Email verified" : "Email not verified"}
            </p>
          </div>
          {isDemo && <Badge variant="warning">Demo account</Badge>}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Email changes require verification and are handled by your administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            {isDemo && (
              <p className="mb-5 flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Saving is turned off in demo mode because there is no account on the server to update.
              </p>
            )}
            <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-5">
              <fieldset disabled={isDemo} className="grid gap-5 disabled:opacity-70">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField id="firstName" label="First name" required error={errors.firstName?.message}>
                    {(a) => <Input {...a} autoComplete="given-name" {...register("firstName")} />}
                  </FormField>
                  <FormField id="lastName" label="Last name" required error={errors.lastName?.message}>
                    {(a) => <Input {...a} autoComplete="family-name" {...register("lastName")} />}
                  </FormField>
                </div>
                <FormField id="phone" label="Mobile number" required error={errors.phone?.message}>
                  {(a) => <Input {...a} type="tel" autoComplete="tel" placeholder="+919876543210" {...register("phone")} />}
                </FormField>
                <FormField id="addressLine1" label="Address" error={errors.addressLine1?.message}>
                  {(a) => <Input {...a} autoComplete="address-line1" {...register("addressLine1")} />}
                </FormField>
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormField id="city" label="City" error={errors.city?.message}>
                    {(a) => <Input {...a} autoComplete="address-level2" {...register("city")} />}
                  </FormField>
                  <FormField id="state" label="State" error={errors.state?.message}>
                    {(a) => <Input {...a} autoComplete="address-level1" {...register("state")} />}
                  </FormField>
                  <FormField id="postalCode" label="PIN code" error={errors.postalCode?.message}>
                    {(a) => <Input {...a} inputMode="numeric" autoComplete="postal-code" {...register("postalCode")} />}
                  </FormField>
                </div>
              </fieldset>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={isDemo || !isDirty} onClick={() => reset()}>
                  Discard
                </Button>
                <Button type="submit" disabled={isDemo || !isDirty} loading={save.isPending}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

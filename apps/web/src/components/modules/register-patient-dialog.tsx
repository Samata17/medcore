"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import type { PatientRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRegisterPatient } from "@/lib/hms";
import { BLOOD_GROUPS, registerPatientSchema, type RegisterPatientForm } from "@/lib/validators/clinical";

export function RegisterPatientDialog({ onRegistered }: { onRegistered?: (p: PatientRow) => void }) {
  const [open, setOpen] = useState(false);
  const registerPatient = useRegisterPatient();
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterPatientForm>({
    resolver: zodResolver(registerPatientSchema),
    defaultValues: { firstName: "", lastName: "", gender: undefined, dateOfBirth: "", phone: "", bloodGroup: "", allergies: "" },
  });

  const onSubmit = handleSubmit((v) =>
    registerPatient.mutate(
      {
        firstName: v.firstName,
        lastName: v.lastName,
        gender: v.gender,
        dateOfBirth: v.dateOfBirth,
        phone: v.phone,
        bloodGroup: v.bloodGroup || undefined,
        allergies: (v.allergies ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      },
      {
        onSuccess: (p) => {
          reset();
          setOpen(false);
          onRegistered?.(p);
        },
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Register patient
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Register a new patient</DialogTitle>
          <DialogDescription>A medical record number (MRN) is created automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="rp-first" label="First name" required error={errors.firstName?.message}>
              {(a) => <Input {...a} {...register("firstName")} />}
            </FormField>
            <FormField id="rp-last" label="Last name" required error={errors.lastName?.message}>
              {(a) => <Input {...a} {...register("lastName")} />}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="rp-gender" label="Gender" required error={errors.gender?.message}>
              {(a) => (
                <NativeSelect {...a} {...register("gender")} defaultValue="">
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </NativeSelect>
              )}
            </FormField>
            <FormField id="rp-dob" label="Date of birth" required error={errors.dateOfBirth?.message}>
              {(a) => <Input {...a} type="date" max={today} {...register("dateOfBirth")} />}
            </FormField>
            <FormField id="rp-blood" label="Blood group" error={errors.bloodGroup?.message}>
              {(a) => (
                <NativeSelect {...a} {...register("bloodGroup")}>
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <FormField id="rp-phone" label="Mobile number" required error={errors.phone?.message}>
            {(a) => <Input {...a} type="tel" placeholder="+91 90000 00000" {...register("phone")} />}
          </FormField>
          <FormField id="rp-allergies" label="Known allergies" hint="Separate with commas, e.g. Penicillin, Peanuts" error={errors.allergies?.message}>
            {(a) => <Input {...a} {...register("allergies")} />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={registerPatient.isPending}>
              Register patient
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

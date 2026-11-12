"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { CONTACT_TOPICS, contactSchema, type ContactInput } from "@/lib/validators/contact";

type Delivery = "webhook" | "logged" | "ignored";

export function ContactForm() {
  const [sent, setSent] = useState<Delivery | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", organization: "", topic: "Hospital onboarding", message: "", website: "" },
  });

  async function onSubmit(values: ContactInput) {
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        const fieldErrors = body?.error?.details as Partial<Record<keyof ContactInput, string[]>> | undefined;
        if (fieldErrors) {
          for (const [field, msgs] of Object.entries(fieldErrors)) {
            if (msgs?.[0]) setError(field as keyof ContactInput, { message: msgs[0] });
          }
        }
        toast.error(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSent(body.data.delivery as Delivery);
      reset();
    } catch {
      toast.error("Network error — check your connection and try again.");
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-8">
        <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Message received</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent === "logged"
              ? "Development mode: your message was validated and logged on the server. No email was sent because CONTACT_WEBHOOK_URL is not configured."
              : "Thanks for reaching out. We'll reply to the email address you provided."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setSent(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Full name" required error={errors.name?.message}>
          {(aria) => <Input {...aria} autoComplete="name" {...register("name")} />}
        </FormField>
        <FormField id="email" label="Work email" required error={errors.email?.message}>
          {(aria) => <Input {...aria} type="email" autoComplete="email" {...register("email")} />}
        </FormField>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="organization" label="Hospital / organization" error={errors.organization?.message}>
          {(aria) => <Input {...aria} autoComplete="organization" {...register("organization")} />}
        </FormField>
        <FormField id="topic" label="Topic" required error={errors.topic?.message}>
          {(aria) => (
            <select
              {...aria}
              {...register("topic")}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {CONTACT_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>
      <FormField id="message" label="Message" required error={errors.message?.message} hint="Minimum 20 characters.">
        {(aria) => <Textarea {...aria} rows={6} {...register("message")} />}
      </FormField>

      {/* Honeypot field, hidden from people and screen readers */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <p className="text-xs text-muted-foreground">
        Please don&apos;t include patient information in this form.
      </p>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-fit">
        {!isSubmitting && <Send />} Send message
      </Button>
    </form>
  );
}

import { z } from "zod";

export const CONTACT_TOPICS = ["Hospital onboarding", "Product question", "Technical support", "Other"] as const;

/** Shared by the contact form (browser) and the /api/contact route (server). */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.email("Enter a valid email address").max(120),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  topic: z.enum(CONTACT_TOPICS, "Choose a topic"),
  message: z.string().trim().min(20, "Please write at least 20 characters").max(2000),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;

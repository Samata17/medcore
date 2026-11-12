import { z } from "zod";

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,14}$/, "Enter a valid phone number (10–14 digits)"),
  addressLine1: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code")
    .optional()
    .or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

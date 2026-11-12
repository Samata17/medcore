import { z } from "zod";

/** Password policy: 8–72 chars (bcrypt limit), upper, lower and a number. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

const email = z.email("Enter a valid email address").max(120);
const otp = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    hospitalId: z.string().min(1, "Choose the hospital where you receive care"),
    firstName: z.string().trim().min(2, "Enter your first name").max(50),
    lastName: z.string().trim().min(1, "Enter your last name").max(50),
    email,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,14}$/, "Enter a valid phone number (10–14 digits)"),
    dateOfBirth: z
      .string()
      .min(1, "Enter your date of birth")
      .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), "Enter a valid past date"),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms to continue"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({ email, otp });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    email,
    otp,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

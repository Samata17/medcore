import { z } from "zod";

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .union([z.literal(""), z.coerce.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v))
    .refine((v) => v === undefined || (v >= min && v <= max), `${label} should be between ${min} and ${max}`);

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const registerPatientSchema = z.object({
  firstName: z.string().trim().min(2, "Enter the first name").max(50),
  lastName: z.string().trim().min(1, "Enter the last name").max(50),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], "Select a gender"),
  dateOfBirth: z
    .string()
    .min(1, "Enter the date of birth")
    .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(), "Enter a valid date (not in the future)"),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,16}$/, "Enter a valid phone number"),
  bloodGroup: z.enum(BLOOD_GROUPS).optional().or(z.literal("")),
  allergies: z.string().trim().max(200).optional(),
});
export type RegisterPatientForm = z.input<typeof registerPatientSchema>;

export const vitalsSchema = z
  .object({
    systolic: optionalNumber(50, 260, "Systolic BP"),
    diastolic: optionalNumber(30, 160, "Diastolic BP"),
    pulse: optionalNumber(20, 250, "Pulse"),
    temperatureC: optionalNumber(30, 45, "Temperature"),
    spo2: optionalNumber(50, 100, "SpO₂"),
    heightCm: optionalNumber(30, 250, "Height"),
    weightKg: optionalNumber(1, 350, "Weight"),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Enter at least one measurement", path: ["systolic"] })
  .refine((v) => (v.systolic === undefined) === (v.diastolic === undefined), {
    message: "Enter both systolic and diastolic values",
    path: ["diastolic"],
  });
export type VitalsForm = z.input<typeof vitalsSchema>;

export const diagnosisSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^$|^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/, "Use ICD-10 format, e.g. I10 or E11.9")
    .optional(),
  description: z.string().trim().min(3, "Describe the diagnosis").max(200),
  type: z.enum(["PROVISIONAL", "FINAL"]),
});
export type DiagnosisForm = z.infer<typeof diagnosisSchema>;

export const noteSchema = z.object({
  symptoms: z.string().trim().min(3, "Record the presenting symptoms").max(2000),
  treatmentPlan: z.string().trim().min(3, "Record the treatment plan").max(2000),
  amendReason: z.string().trim().max(300).optional(),
});
export type NoteForm = z.infer<typeof noteSchema>;

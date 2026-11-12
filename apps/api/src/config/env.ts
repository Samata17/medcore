import { z } from "zod";

/**
 * Environment variables are validated once at startup.
 * The API refuses to start with missing or unsafe configuration.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().positive().default(4100),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),
    // How many proxies sit in front of the API (for the real client IP in rate limits & audit logs).
    // 1 = the hosting platform's load balancer. Use 2 when sign-in goes through the website's proxy.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    OTP_SECRET: z.string().min(32, "OTP_SECRET must be at least 32 characters"),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default("MedCore HMS <no-reply@medcore.local>"),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Online payments need both halves of the key pair, or neither.
    if (!!env.RAZORPAY_KEY_ID !== !!env.RAZORPAY_KEY_SECRET) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_SECRET"], message: "Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or leave both empty" });
    }
    if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_SECURE) {
      ctx.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "SameSite=None cookies must be Secure" });
    }
    if (env.NODE_ENV !== "production") return;
    for (const key of ["JWT_ACCESS_SECRET", "OTP_SECRET"] as const) {
      if (/CHANGE_ME/i.test(env[key])) ctx.addIssue({ code: "custom", path: [key], message: "Replace the placeholder secret before running in production" });
    }
    if (env.JWT_ACCESS_SECRET === env.OTP_SECRET) {
      ctx.addIssue({ code: "custom", path: ["OTP_SECRET"], message: "OTP_SECRET must differ from JWT_ACCESS_SECRET" });
    }
    if (!env.SMTP_HOST) ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP is required in production (OTP codes must be emailed)" });
    if (!env.COOKIE_SECURE) {
      ctx.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "Production must use Secure cookies (HTTPS). Set COOKIE_SECURE=true" });
    }
    if (env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "This project supports Razorpay test mode only (rzp_test_ keys)" });
    }
    if (env.WEB_ORIGIN.split(",").some((o) => o.trim() === "*")) {
      ctx.addIssue({ code: "custom", path: ["WEB_ORIGIN"], message: "WEB_ORIGIN must list exact origins, not *" });
    }
  });

export type Env = z.infer<typeof schema>;

/** Validates a set of variables. Throws a readable error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Hosting platforms (Render, Railway, Heroku-style) tell the app which port to use via PORT.
  const parsed = schema.safeParse({ ...source, API_PORT: source.API_PORT || source.PORT });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee apps/api/.env.example`);
  }
  return parsed.data;
}

let cached: Env | null = null;

export function env(): Env {
  return (cached ??= parseEnv(process.env));
}

/** Origins allowed by CORS (comma-separated WEB_ORIGIN). */
export const allowedOrigins = () => env().WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

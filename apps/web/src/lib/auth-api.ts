import type { AuthUser } from "@medcore/types";
import { apiFetch, authFetch } from "@/lib/api";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@/lib/validators/auth";
import type { ProfileInput } from "@/lib/validators/profile";

/** Typed calls to the NestJS auth module (implemented in Stage 4). */
export const authApi = {
  login: (body: LoginInput) =>
    apiFetch<{ user: AuthUser; accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: ({ confirmPassword: _c, acceptTerms: _a, ...body }: RegisterInput) =>
    apiFetch<{ email: string }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  verifyEmail: (body: VerifyEmailInput) =>
    apiFetch<{ verified: true }>("/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),

  resendOtp: (email: string) =>
    apiFetch<{ sent: true }>("/auth/resend-otp", { method: "POST", body: JSON.stringify({ email }) }),

  forgotPassword: (body: ForgotPasswordInput) =>
    apiFetch<{ sent: true }>("/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),

  resetPassword: ({ confirmPassword: _c, ...body }: ResetPasswordInput) =>
    apiFetch<{ reset: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),

  /** Active hospitals a patient can register with (public endpoint). */
  publicHospitals: () => apiFetch<{ id: string; name: string; city: string }[]>("/public/hospitals"),

  me: () =>
    authFetch<AuthUser & { phone: string | null; address: { line1: string; city: string; state: string; postalCode: string } | null }>("/users/me"),

  /** Revokes the refresh token on the server and clears its cookie. */
  logout: () => apiFetch<{ loggedOut: true }>("/auth/logout", { method: "POST" }),

  updateProfile: (body: ProfileInput) =>
    authFetch<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
};

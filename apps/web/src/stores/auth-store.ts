import { create } from "zustand";
import type { AuthUser } from "@medcore/types";

/**
 * Client auth state.
 * - "live": signed in through the API. The access token lives in memory only;
 *   the refresh token is an HTTP-only cookie the browser JavaScript can't read.
 * - "demo": exploring a role with clearly labeled sample data. No API calls.
 */
export type SessionMode = "live" | "demo";
export type SessionStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  status: SessionStatus;
  mode: SessionMode | null;
  user: AuthUser | null;
  accessToken: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setDemoSession: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  setAnonymous: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  mode: null,
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ status: "authenticated", mode: "live", user, accessToken }),
  setDemoSession: (user) => set({ status: "authenticated", mode: "demo", user, accessToken: null }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setAnonymous: () => set({ status: "anonymous", mode: null, user: null, accessToken: null }),
  clear: () => set({ status: "anonymous", mode: null, user: null, accessToken: null }),
}));

import type { ApiResponse, AuthUser } from "@medcore/types";
import { useAuthStore } from "@/stores/auth-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";

/**
 * With NEXT_PUBLIC_AUTH_PROXY=true, sign-in routes (/auth/*) go through this website's own
 * address and Next.js forwards them to the API (see next.config.ts). The refresh cookie then
 * belongs to the website's domain, so browsers that block third-party cookies (Safari, Firefox
 * strict mode) keep users signed in across page reloads even when the API is on another domain.
 * Every other request goes straight to the API with the bearer token (no cookies needed).
 */
const AUTH_VIA_PROXY = process.env.NEXT_PUBLIC_AUTH_PROXY === "true";
const urlFor = (path: string) => (AUTH_VIA_PROXY && path.startsWith("/auth/") ? `/api/v1${path}` : `${API_URL}${path}`);

/** Error thrown for any failed API call, with a user-friendly message. */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Small fetch wrapper for the MedCore API.
 * - Sends cookies (refresh token lives in an HTTP-only cookie).
 * - Unwraps the `{ success, data }` envelope.
 * - Turns network failures into a clear message instead of a fake success.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(urlFor(path), {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        // Required by the API on cookie-authenticated routes (CSRF defence).
        "x-medcore-csrf": "1",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the MedCore API at ${API_URL}. Make sure the backend server is running.`,
      0,
    );
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON response (e.g. proxy error page)
  }

  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.success === false ? body.error.message : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body && body.success === false ? body.error.details : undefined);
  }

  return body.data;
}

/** Shared in-flight refresh so parallel 401s trigger only one refresh call. */
let refreshing: Promise<{ user: AuthUser; accessToken: string }> | null = null;

/** Exchange the HTTP-only refresh cookie for a new access token (rotates the refresh token). */
export function refreshSession() {
  refreshing ??= apiFetch<{ user: AuthUser; accessToken: string }>("/auth/refresh", { method: "POST" }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Raw authenticated fetch (for files), refreshing the access token once on 401. */
async function rawAuthFetch(path: string, init: RequestInit = {}) {
  const run = (token: string | null) =>
    fetch(urlFor(path), {
      ...init,
      credentials: "include",
      headers: { "x-medcore-csrf": "1", ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  let res: Response;
  try {
    res = await run(useAuthStore.getState().accessToken);
    if (res.status === 401) {
      const { user, accessToken } = await refreshSession();
      useAuthStore.getState().setSession(user, accessToken);
      res = await run(accessToken);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(`Cannot reach the MedCore API at ${API_URL}.`, 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return res;
}

/** Upload one file as multipart/form-data (field "file"). */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await rawAuthFetch(path, { method: "POST", body: form });
  return ((await res.json()) as { data: T }).data;
}

/** Download a protected file and hand it to the browser as a normal download. */
export async function downloadFile(path: string, fileName: string) {
  const res = await rawAuthFetch(path);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Authenticated request: attaches the in-memory access token and,
 * if it has expired (401), refreshes once and retries.
 */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const withToken = (token: string | null): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  try {
    return await apiFetch<T>(path, withToken(useAuthStore.getState().accessToken));
  } catch (err) {
    if (!(err instanceof ApiError) || err.statusCode !== 401) throw err;
    try {
      const { user, accessToken } = await refreshSession();
      useAuthStore.getState().setSession(user, accessToken);
      return await apiFetch<T>(path, withToken(accessToken));
    } catch {
      useAuthStore.getState().clear();
      throw new ApiError("Your session has expired. Please log in again.", 401);
    }
  }
}

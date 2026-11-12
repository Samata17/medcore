"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/**
 * One hook for every dashboard data source.
 * - Live mode: calls the real API endpoint (`path`).
 * - Demo mode: returns the fictional `demo()` data, and `isSample` is true so
 *   the page can label it. Demo data is never presented as live data.
 */
export function useHmsQuery<T>({ key, path, demo }: { key: readonly unknown[]; path: string; demo: () => T }) {
  const mode = useAuthStore((s) => s.mode);
  const query = useQuery<T>({
    queryKey: [mode, ...key],
    queryFn: mode === "demo" ? async () => demo() : () => authFetch<T>(path),
    enabled: mode !== null,
  });
  return { ...query, isSample: mode === "demo" };
}

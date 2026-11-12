import { Skeleton } from "@/components/ui/skeleton";

/** /dashboard redirects to the signed-in role's home (handled by SessionGate). */
export default function DashboardIndex() {
  return <Skeleton className="h-40 w-full" aria-label="Redirecting to your dashboard" />;
}

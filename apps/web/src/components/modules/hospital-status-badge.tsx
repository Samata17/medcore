import type { HospitalRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";

export function HospitalStatusBadge({ status }: { status: HospitalRow["status"] }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "SUSPENDED") return <Badge variant="danger">Suspended</Badge>;
  return <Badge variant="warning">Pending verification</Badge>;
}

export const PLAN_PRICE: Record<HospitalRow["plan"], number> = { BASIC: 25_000, PROFESSIONAL: 60_000, ENTERPRISE: 150_000 };
export const PLAN_LABEL: Record<HospitalRow["plan"], string> = { BASIC: "Basic", PROFESSIONAL: "Professional", ENTERPRISE: "Enterprise" };

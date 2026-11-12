import { daysToExpiry, type MedicineBatchRow } from "@medcore/types";
import { Badge } from "@/components/ui/badge";

export const EXPIRY_WARNING_DAYS = 60;

export function ExpiryBadge({ batch }: { batch: MedicineBatchRow }) {
  const d = daysToExpiry(batch);
  if (d <= 0) return <Badge variant="danger">Expired · blocked</Badge>;
  if (d <= EXPIRY_WARNING_DAYS) return <Badge variant="warning">Expires in {d} d</Badge>;
  return <Badge variant="success">{d} d left</Badge>;
}

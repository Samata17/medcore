import { FlaskRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className} title="Fictional data shown in demo mode">
      <FlaskRound aria-hidden /> Sample data
    </Badge>
  );
}

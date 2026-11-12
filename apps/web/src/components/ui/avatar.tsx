import { cn } from "@/lib/utils";

/** Initials avatar. We never show real patient photos in demos. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

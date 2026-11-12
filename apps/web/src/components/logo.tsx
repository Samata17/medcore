import Link from "next/link";
import { cn } from "@/lib/utils";

/** MedCore mark: a rounded tile with a soft cross and a pulse line. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "fill-primary-foreground" : "fill-primary";
  const cross = inverted ? "fill-primary" : "fill-primary-foreground";
  const pulse = inverted ? "stroke-primary" : "stroke-primary-foreground";
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className={tile} />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" className={cross} opacity="0.18" />
      <path
        d="M6 17h5l2-4 3 8 2.5-6 1.5 2H26"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={pulse}
      />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  inverted = false,
}: {
  className?: string;
  href?: string;
  /** Use on a primary-colored background. */
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-fit items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <LogoMark inverted={inverted} />
      <span className="font-display text-lg font-bold tracking-tight">
        MedCore<span className={inverted ? "text-teal-soft" : "text-teal"}> HMS</span>
      </span>
    </Link>
  );
}

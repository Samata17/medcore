import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal uppercase">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold text-balance sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-lg text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}

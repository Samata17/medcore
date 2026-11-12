import { SampleDataBadge } from "@/components/dashboard/sample-data-badge";

export function PageHeader({
  title,
  description,
  actions,
  sample,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Show the "Sample data" label next to the title. */
  sample?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold sm:text-[1.65rem]">{title}</h1>
          {sample && <SampleDataBadge />}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

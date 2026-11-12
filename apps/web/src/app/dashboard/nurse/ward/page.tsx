"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorState } from "@/components/dashboard/states";
import { BedBoard } from "@/components/modules/bed-board";
import { useBeds } from "@/lib/hms";

export default function WardPage() {
  const beds = useBeds();
  return (
    <>
      <PageHeader title="Ward management" description="Discharge, cleaning and availability for every bed." sample={beds.isSample} />
      {beds.isLoading ? <Skeleton className="h-96" /> : beds.isError ? <ErrorState onRetry={() => beds.refetch()} /> : <BedBoard beds={beds.data ?? []} />}
    </>
  );
}

"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { LabOrdersTable } from "@/components/modules/lab/lab-orders-table";
import { useLabOrders } from "@/lib/hms";

export default function LabOrdersPage() {
  const orders = useLabOrders();
  return (
    <>
      <PageHeader
        title="Test orders"
        description="Collect → process → enter results → approve. Patients see reports only after approval."
        sample={orders.isSample}
      />
      <LabOrdersTable data={orders.data} isLoading={orders.isLoading} isError={orders.isError} onRetry={() => orders.refetch()} />
    </>
  );
}

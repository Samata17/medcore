"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { CreateInvoiceDialog, InvoicesTable } from "@/components/modules/billing/invoices-table";
import { useInvoices, usePatients } from "@/lib/hms";

export default function ReceptionBilling() {
  const invoices = useInvoices();
  const patients = usePatients();
  return (
    <>
      <PageHeader
        title="Billing"
        description="Generate invoices at the counter and record cash, card or UPI payments."
        sample={invoices.isSample}
        actions={<CreateInvoiceDialog patients={patients.data ?? []} />}
      />
      <InvoicesTable canCollect data={invoices.data} isLoading={invoices.isLoading} isError={invoices.isError} onRetry={() => invoices.refetch()} />
    </>
  );
}

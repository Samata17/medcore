"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { CreateInvoiceDialog, InvoicesTable } from "@/components/modules/billing/invoices-table";
import { useInvoices, usePatients } from "@/lib/hms";

export default function AccountsInvoices() {
  const invoices = useInvoices();
  const patients = usePatients();
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Consultation, laboratory, pharmacy and room charges with GST."
        sample={invoices.isSample}
        actions={<CreateInvoiceDialog patients={patients.data ?? []} />}
      />
      <InvoicesTable canCollect data={invoices.data} isLoading={invoices.isLoading} isError={invoices.isError} onRetry={() => invoices.refetch()} />
    </>
  );
}

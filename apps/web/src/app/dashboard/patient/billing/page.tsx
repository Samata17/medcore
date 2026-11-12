"use client";

import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvoicesTable } from "@/components/modules/billing/invoices-table";
import { PayOnlineButton, usePaymentConfig } from "@/components/modules/billing/pay-online";
import { useInvoices } from "@/lib/hms";
import { formatCurrency } from "@/lib/format";

export default function PatientBilling() {
  const invoices = useInvoices("mine");
  const config = usePaymentConfig();
  const online = config.data?.online === true;
  const due = (invoices.data ?? []).filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID").reduce((s, i) => s + i.total - i.paid, 0);
  const paid = (invoices.data ?? []).reduce((s, i) => s + i.paid, 0);

  return (
    <>
      <PageHeader title="Billing" description="Your invoices, receipts and payment status." sample={invoices.isSample} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="gap-1 p-5">
          <p className="text-sm text-muted-foreground">Balance due</p>
          <p className="font-display text-2xl font-bold tabular-nums">{formatCurrency(due, true)}</p>
        </Card>
        <Card className="gap-1 p-5">
          <p className="text-sm text-muted-foreground">Paid to date</p>
          <p className="font-display text-2xl font-bold tabular-nums">{formatCurrency(paid, true)}</p>
        </Card>
      </div>
      <p className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden />
        {invoices.isSample
          ? "Demo mode: online payment isn't available. In the live system you can pay at the counter or online when the hospital enables it."
          : online
            ? "Pay online securely (Razorpay test mode), or at the billing counter by cash, card or UPI."
            : "Pay at the hospital billing counter by cash, card or UPI. Online payment isn't enabled for this hospital yet."}
      </p>
      <InvoicesTable
        showPatient={false}
        data={invoices.data}
        isLoading={invoices.isLoading}
        isError={invoices.isError}
        onRetry={() => invoices.refetch()}
        payAction={online ? (i) => <PayOnlineButton invoice={i} /> : undefined}
      />
    </>
  );
}

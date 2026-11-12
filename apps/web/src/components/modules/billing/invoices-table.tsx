"use client";

import { useState } from "react";
import { IndianRupee, Plus, Trash2 } from "lucide-react";
import { INVOICE_STATUSES, invoiceTotals, type InvoiceItemRow, type InvoiceRow, type PatientRow } from "@medcore/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DataTable } from "@/components/dashboard/data-table";
import { InvoiceStatusBadge, invoiceStatusLabel } from "@/components/dashboard/status-badge";
import { InvoiceDialog } from "@/components/modules/billing/invoice-document";
import { useCreateInvoice, useRecordPayment } from "@/lib/hms";
import { formatCurrency, formatDate } from "@/lib/format";

/* ---------- Record payment ---------- */

function PaymentDialog({ invoice }: { invoice: InvoiceRow }) {
  const pay = useRecordPayment();
  const due = Math.round((invoice.total - invoice.paid) * 100) / 100;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"CASH" | "CARD" | "UPI" | "INSURANCE">("CASH");
  const [error, setError] = useState("");

  function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || n > due) return setError(`Enter an amount between ₹1 and ${formatCurrency(due, true)}`);
    setError("");
    pay.mutate({ invoiceId: invoice.id, amount: n, method }, { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setAmount(String(due)); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <IndianRupee /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment · {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.patientName} · balance due {formatCurrency(due, true)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="pay-amount" label="Amount (₹)" required error={error}>
            {(a) => <Input {...a} type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </FormField>
          <FormField id="pay-method" label="Method">
            {(a) => (
              <NativeSelect {...a} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card (counter terminal)</option>
                <option value="UPI">UPI (counter QR)</option>
                <option value="INSURANCE">Insurance settlement</option>
              </NativeSelect>
            )}
          </FormField>
          <p className="text-xs text-muted-foreground">
            Online payments (Razorpay/Stripe test mode) are marked paid only after the server verifies the gateway signature.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pay.isPending}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Create invoice ---------- */

const CATEGORIES: { value: InvoiceItemRow["category"]; label: string; tax: number }[] = [
  { value: "CONSULTATION", label: "Consultation", tax: 0 },
  { value: "LAB", label: "Laboratory", tax: 0 },
  { value: "PHARMACY", label: "Pharmacy", tax: 12 },
  { value: "ROOM", label: "Room charges", tax: 5 },
  { value: "PROCEDURE", label: "Procedure", tax: 0 },
];

export function CreateInvoiceDialog({ patients }: { patients: PatientRow[] }) {
  const create = useCreateInvoice();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [line, setLine] = useState({ category: "CONSULTATION" as InvoiceItemRow["category"], description: "Consultation", quantity: 1, unitPrice: 0 });
  const [error, setError] = useState("");
  const totals = invoiceTotals(items);

  function addLine() {
    if (!line.description.trim()) return setError("Enter a description");
    if (line.quantity < 1 || line.unitPrice <= 0) return setError("Quantity and price must be greater than zero");
    setError("");
    const tax = CATEGORIES.find((c) => c.value === line.category)!.tax;
    setItems([...items, { ...line, description: line.description.trim(), taxRate: tax }]);
    setLine({ ...line, quantity: 1, unitPrice: 0 });
  }

  function submit() {
    if (!patientId) return setError("Choose a patient");
    if (!items.length) return setError("Add at least one charge");
    create.mutate(
      { patientId, items },
      {
        onSuccess: () => {
          setOpen(false);
          setItems([]);
          setPatientId("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate invoice</DialogTitle>
          <DialogDescription>GST is applied per category (pharmacy 12%, room 5%, consultation & lab exempt — sample tax configuration).</DialogDescription>
        </DialogHeader>
        <FormField id="ci-patient" label="Patient" required>
          {(a) => (
            <NativeSelect {...a} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.mrn}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[9rem_1fr_4.5rem_6.5rem_auto] sm:items-end">
          <FormField id="ci-cat" label="Category">
            {(a) => (
              <NativeSelect
                {...a}
                value={line.category}
                onChange={(e) => {
                  const c = CATEGORIES.find((x) => x.value === e.target.value)!;
                  setLine({ ...line, category: c.value, description: c.label });
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="ci-desc" label="Description">
            {(a) => <Input {...a} value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} />}
          </FormField>
          <FormField id="ci-qty" label="Qty">
            {(a) => <Input {...a} type="number" min={1} value={line.quantity} onChange={(e) => setLine({ ...line, quantity: Number(e.target.value) })} />}
          </FormField>
          <FormField id="ci-price" label="Rate (₹)">
            {(a) => <Input {...a} type="number" min={0} step="0.01" value={line.unitPrice || ""} onChange={(e) => setLine({ ...line, unitPrice: Number(e.target.value) })} />}
          </FormField>
          <Button type="button" variant="outline" onClick={addLine} aria-label="Add charge">
            <Plus />
          </Button>
        </div>
        {items.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {items.map((i, n) => (
              <li key={n} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {i.description} <span className="text-muted-foreground">× {i.quantity} @ {formatCurrency(i.unitPrice, true)} · GST {i.taxRate}%</span>
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.description}`} onClick={() => setItems(items.filter((_, k) => k !== n))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <dl className="ml-auto grid w-60 gap-1 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCurrency(totals.subtotal, true)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">GST</dt><dd>{formatCurrency(totals.tax, true)}</dd></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><dt>Total</dt><dd>{formatCurrency(totals.total, true)}</dd></div>
        </dl>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Issue invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Table ---------- */

export function InvoicesTable({
  data,
  isLoading,
  isError,
  onRetry,
  canCollect = false,
  showPatient = true,
  toolbar,
  payAction,
}: {
  data?: InvoiceRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  canCollect?: boolean;
  showPatient?: boolean;
  toolbar?: React.ReactNode;
  /** Extra action for unpaid invoices (e.g. the patient's "Pay online"). */
  payAction?: (i: InvoiceRow) => React.ReactNode;
}) {
  return (
    <DataTable
      data={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      getRowId={(i) => i.id}
      caption="Invoices"
      searchText={(i) => `${i.number} ${i.patientName}`}
      searchPlaceholder="Search invoice or patient"
      filters={[{ id: "status", label: "Statuses", options: INVOICE_STATUSES.map((s) => ({ value: s, label: invoiceStatusLabel(s) })), match: (i, v) => i.status === v }]}
      emptyTitle="No invoices"
      toolbar={toolbar}
      columns={[
        { id: "number", header: "Invoice", sortValue: (i) => i.issuedAt, cell: (i) => <div><p className="font-medium">{i.number}</p><p className="text-xs text-muted-foreground">{formatDate(i.issuedAt)}</p></div> },
        ...(showPatient ? [{ id: "patient", header: "Patient", sortValue: (i: InvoiceRow) => i.patientName, cell: (i: InvoiceRow) => i.patientName }] : []),
        { id: "items", header: "Charges", hideBelow: "lg", cell: (i) => <span className="text-muted-foreground">{[...new Set(i.items.map((x) => x.category.toLowerCase()))].join(", ")}</span> },
        { id: "total", header: "Total", sortValue: (i) => i.total, className: "text-right", cell: (i) => <span className="font-medium tabular-nums">{formatCurrency(i.total, true)}</span> },
        { id: "due", header: "Balance", hideBelow: "md", sortValue: (i) => i.total - i.paid, className: "text-right", cell: (i) => <span className="tabular-nums">{i.status === "VOID" ? "—" : formatCurrency(Math.max(0, i.total - i.paid), true)}</span> },
        { id: "status", header: "Status", sortValue: (i) => i.status, cell: (i) => <InvoiceStatusBadge status={i.status} /> },
        {
          id: "actions",
          header: "",
          className: "text-right",
          cell: (i) => (
            <div className="flex justify-end gap-2">
              {canCollect && (i.status === "ISSUED" || i.status === "PARTIALLY_PAID") && <PaymentDialog invoice={i} />}
              {payAction && (i.status === "ISSUED" || i.status === "PARTIALLY_PAID") && payAction(i)}
              <InvoiceDialog invoice={i} />
            </div>
          ),
        },
      ]}
    />
  );
}

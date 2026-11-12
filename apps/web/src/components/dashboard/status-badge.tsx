import type { AppointmentStatus, InvoiceStatus, LabOrderStatus } from "@medcore/types";
import { Badge } from "@/components/ui/badge";

type Variant = "info" | "teal" | "success" | "warning" | "danger" | "neutral";

const APPOINTMENT: Record<AppointmentStatus, [string, Variant]> = {
  PENDING: ["Pending", "warning"],
  CONFIRMED: ["Confirmed", "teal"],
  IN_PROGRESS: ["In progress", "info"],
  COMPLETED: ["Completed", "success"],
  CANCELLED: ["Cancelled", "neutral"],
  NO_SHOW: ["No-show", "danger"],
};

const LAB: Record<LabOrderStatus, [string, Variant]> = {
  ORDERED: ["Ordered", "warning"],
  SAMPLE_COLLECTED: ["Sample collected", "teal"],
  PROCESSING: ["Processing", "info"],
  RESULT_ENTERED: ["Awaiting approval", "warning"],
  APPROVED: ["Approved", "success"],
  CANCELLED: ["Cancelled", "neutral"],
};

const INVOICE: Record<InvoiceStatus, [string, Variant]> = {
  DRAFT: ["Draft", "neutral"],
  ISSUED: ["Unpaid", "warning"],
  PARTIALLY_PAID: ["Partially paid", "info"],
  PAID: ["Paid", "success"],
  VOID: ["Void", "neutral"],
};

export const appointmentStatusLabel = (s: AppointmentStatus) => APPOINTMENT[s][0];
export const labStatusLabel = (s: LabOrderStatus) => LAB[s][0];
export const invoiceStatusLabel = (s: InvoiceStatus) => INVOICE[s][0];

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const [label, variant] = APPOINTMENT[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function LabStatusBadge({ status }: { status: LabOrderStatus }) {
  const [label, variant] = LAB[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const [label, variant] = INVOICE[status];
  return <Badge variant={variant}>{label}</Badge>;
}

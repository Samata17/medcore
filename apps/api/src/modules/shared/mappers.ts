import type { Prisma } from "@prisma/client";

/** Prisma includes + mappers to the row shapes in @medcore/types, shared by several modules. */

export const prescriptionInclude = {
  patient: { select: { firstName: true, lastName: true } },
  doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
  items: { include: { medicine: { select: { name: true } } } },
} satisfies Prisma.PrescriptionInclude;

export const toPrescriptionRow = (r: Prisma.PrescriptionGetPayload<{ include: typeof prescriptionInclude }>) => ({
  id: r.id,
  code: r.code,
  patientId: r.patientId,
  patientName: `${r.patient.firstName} ${r.patient.lastName}`,
  doctorName: `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName}`,
  issuedAt: r.issuedAt.toISOString(),
  status: r.status,
  items: r.items.map((i) => ({
    medicineId: i.medicineId,
    medicineName: i.medicine.name,
    dosage: i.dosage,
    frequency: i.frequency,
    durationDays: i.durationDays,
    instructions: i.instructions ?? undefined,
    quantity: i.quantity,
  })),
});

export const labOrderInclude = {
  patient: { select: { firstName: true, lastName: true, userId: true } },
  labTest: { select: { name: true } },
  orderedBy: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
  results: { orderBy: { enteredAt: "asc" as const } },
  attachments: { select: { id: true, fileName: true } },
} satisfies Prisma.LabOrderInclude;

export type LabOrderWith = Prisma.LabOrderGetPayload<{ include: typeof labOrderInclude }>;

/** `approverNames` maps approvedById → display name. */
export const toLabOrderRow = (o: LabOrderWith, approverNames: Map<string, string>) => ({
  id: o.id,
  code: o.code,
  patientId: o.patientId,
  patientName: `${o.patient.firstName} ${o.patient.lastName}`,
  testName: o.labTest.name,
  orderedBy: `Dr. ${o.orderedBy.user.firstName} ${o.orderedBy.user.lastName}`,
  orderedAt: o.orderedAt.toISOString(),
  priority: o.priority,
  status: o.status,
  results: o.results.length
    ? o.results.map((r) => ({ parameter: r.parameter, value: Number(r.value), unit: r.unit, refLow: Number(r.refLow), refHigh: Number(r.refHigh) }))
    : undefined,
  approvedBy: o.approvedById ? approverNames.get(o.approvedById) : undefined,
  attachments: o.attachments,
});

export const invoiceInclude = {
  patient: { select: { firstName: true, lastName: true, userId: true } },
  items: true,
  payments: { where: { status: "SUCCEEDED" as const }, orderBy: { confirmedAt: "desc" as const }, take: 1, select: { method: true } },
} satisfies Prisma.InvoiceInclude;

export const toInvoiceRow = (i: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>) => ({
  id: i.id,
  number: i.number,
  patientId: i.patientId,
  patientName: `${i.patient.firstName} ${i.patient.lastName}`,
  issuedAt: i.issuedAt.toISOString(),
  dueAt: i.dueAt.toISOString(),
  status: i.status,
  items: i.items.map((x) => ({ description: x.description, category: x.category, quantity: x.quantity, unitPrice: Number(x.unitPrice), taxRate: Number(x.taxRate) })),
  subtotal: Number(i.subtotal),
  tax: Number(i.tax),
  total: Number(i.total),
  paid: Number(i.amountPaid),
  lastPaymentMethod: i.payments[0]?.method,
});

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ChargeCategory, ClaimStatus, Prisma } from "@prisma/client";
import { invoiceTotals } from "@medcore/types";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from "class-validator";
import type { Request } from "express";
import { isValidRazorpayPayment, isValidWebhookSignature } from "../../common/security";
import type { RequestUser } from "../../common/auth-types";
import { randomCode, withUniqueCode } from "../../common/codes";
import { CurrentUser, Public, RequireAnyPermission, RequirePermissions } from "../../common/decorators";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { invoiceInclude, toInvoiceRow } from "../shared/mappers";

/**
 * GST per charge category (sample configuration — confirm rates with an accountant).
 * The server always applies these; tax rates sent by the browser are ignored.
 */
export const TAX_RATE: Record<ChargeCategory, number> = { CONSULTATION: 0, LAB: 0, PHARMACY: 12, ROOM: 5, PROCEDURE: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;
const razorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && secret ? { keyId, secret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET } : null;
};

class InvoiceItemDto {
  @IsEnum(ChargeCategory) category: ChargeCategory;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value)) @IsString() @Length(2, 120) description: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10_000_000) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number; // ignored
}

class CreateInvoiceDto {
  @IsUUID() patientId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items: InvoiceItemDto[];
}

class CounterPaymentDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsIn(["CASH", "CARD", "UPI", "INSURANCE"]) method: "CASH" | "CARD" | "UPI" | "INSURANCE";
}

class VerifyRazorpayDto {
  @IsString() @Length(5, 60) orderId: string;
  @IsString() @Length(5, 60) paymentId: string;
  @IsString() @Length(64, 64) signature: string;
}

class ClaimStatusDto {
  @IsEnum(ClaimStatus) status: ClaimStatus;
}

const CLAIM_FLOW: Record<ClaimStatus, ClaimStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["SETTLED"],
  REJECTED: ["DRAFT"],
  SETTLED: [],
};

@ApiTags("Billing & payments")
@ApiBearerAuth()
@Controller()
export class BillingController {
  private readonly logger = new Logger("Billing");
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  @Get("billing/invoices")
  @RequirePermissions(P.BILLING_MANAGE)
  async list(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.invoice.findMany({ where: { hospitalId: hospitalOf(user) }, include: invoiceInclude, orderBy: { issuedAt: "desc" }, take: 500 });
    return rows.map(toInvoiceRow);
  }

  @Get("me/invoices")
  @RequirePermissions(P.SELF_PORTAL)
  async mine(@CurrentUser() user: RequestUser) {
    if (!user.patientId) return [];
    const rows = await this.prisma.invoice.findMany({ where: { patientId: user.patientId, status: { not: "DRAFT" } }, include: invoiceInclude, orderBy: { issuedAt: "desc" } });
    return rows.map(toInvoiceRow);
  }

  @Post("billing/invoices")
  @RequirePermissions(P.BILLING_MANAGE)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, hospitalId }, select: { id: true, mrn: true, userId: true } });
    if (!patient) throw new NotFoundException("Patient not found");

    const items = dto.items.map((i) => ({ category: i.category, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: TAX_RATE[i.category] }));
    const totals = invoiceTotals(items);
    const year = new Date().getFullYear();
    const inv = await withUniqueCode(
      `INV-${year}`,
      (number) =>
        this.prisma.invoice.create({
          data: { hospitalId, number, patientId: patient.id, status: "ISSUED", ...totals, dueAt: new Date(Date.now() + 15 * 86_400_000), createdById: user.id, items: { create: items } },
          include: invoiceInclude,
        }),
      5,
    );
    await this.notify.toUsers([patient.userId], hospitalId, {
      type: "INVOICE_ISSUED",
      title: "New invoice",
      body: `${inv.number} for ₹${totals.total.toLocaleString("en-IN")} has been issued.`,
      href: "/dashboard/patient/billing",
    });
    await this.audit.log({ action: "INVOICE_ISSUE", entity: `${inv.number} (${patient.mrn}) ₹${totals.total}`, entityId: inv.id, actor: user, req });
    return toInvoiceRow(inv);
  }

  /**
   * Adds a confirmed payment to an invoice inside a transaction with the invoice
   * row locked, so two cashiers (or a webhook + browser) can't double-count.
   */
  private async applyPayment(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    amount: number,
    payment: Omit<Prisma.PaymentUncheckedCreateInput, "invoiceId" | "amount"> & { id?: string },
  ) {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (inv.status === "VOID" || inv.status === "PAID") throw new BadRequestException("This invoice can't take payments");
    const due = r2(Number(inv.total) - Number(inv.amountPaid));
    if (amount <= 0 || amount > due) throw new BadRequestException(`Amount must be between ₹0.01 and ₹${due}`);

    const receiptNumber = randomCode("RCPT", 8);
    if (payment.id) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", confirmedAt: new Date(), receiptNumber, gatewayPayId: payment.gatewayPayId } });
    } else {
      await tx.payment.create({ data: { ...payment, invoiceId, amount, status: "SUCCEEDED", confirmedAt: new Date(), receiptNumber } });
    }
    const paid = r2(Number(inv.amountPaid) + amount);
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: paid, status: paid >= Number(inv.total) ? "PAID" : "PARTIALLY_PAID" },
      include: invoiceInclude,
    });
  }

  /** Cash / card terminal / UPI QR / insurance settlement recorded by staff. */
  @Post("billing/invoices/:id/payments")
  @RequirePermissions(P.BILLING_MANAGE)
  async counterPayment(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CounterPaymentDto, @Req() req: Request) {
    const exists = await this.prisma.invoice.findFirst({ where: { id, hospitalId: hospitalOf(user) }, select: { id: true } });
    if (!exists) throw new NotFoundException("Invoice not found");
    const inv = await this.prisma.$transaction((tx) => this.applyPayment(tx, id, r2(dto.amount), { method: dto.method, recordedById: user.id }));
    await this.paid(inv, dto.amount);
    await this.audit.log({ action: "PAYMENT_RECORD", entity: `${inv.number} ₹${dto.amount} (${dto.method})`, entityId: id, actor: user, req });
    return toInvoiceRow(inv);
  }

  private async paid(inv: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>, amount: number) {
    await this.notify.toUsers([inv.patient.userId], inv.hospitalId, {
      type: "PAYMENT_RECEIVED",
      title: "Payment received",
      body: `₹${amount.toLocaleString("en-IN")} received for ${inv.number}. Thank you.`,
      href: "/dashboard/patient/billing",
    });
  }

  /* ---------------- Online payments (Razorpay test mode) ---------------- */

  /** Tells the UI whether online payment is configured. */
  @Get("billing/config")
  config() {
    const rp = razorpay();
    return { online: !!rp, provider: rp ? "razorpay" : null, keyId: rp?.keyId ?? null };
  }

  /** Creates a Razorpay order for the invoice balance. The payment stays PENDING until verified. */
  @Post("billing/invoices/:id/online-order")
  @RequireAnyPermission(P.SELF_PORTAL, P.BILLING_MANAGE)
  async onlineOrder(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    const rp = razorpay();
    if (!rp) throw new ServiceUnavailableException("Online payments are not configured. Please pay at the billing counter.");
    const inv = await this.prisma.invoice.findFirst({ where: { id, hospitalId: hospitalOf(user), ...(user.role === "PATIENT" ? { patientId: user.patientId ?? "none" } : {}) } });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.status === "PAID" || inv.status === "VOID") throw new BadRequestException("Nothing to pay on this invoice");
    const due = r2(Number(inv.total) - Number(inv.amountPaid));

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${rp.keyId}:${rp.secret}`).toString("base64")}` },
      body: JSON.stringify({ amount: Math.round(due * 100), currency: "INR", receipt: inv.number, notes: { invoiceId: inv.id } }),
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.error(`Razorpay order failed: ${res?.status}`);
      throw new ServiceUnavailableException("The payment gateway is unavailable. Please try again or pay at the counter.");
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    await this.prisma.payment.create({ data: { invoiceId: inv.id, amount: due, method: "RAZORPAY", status: "PENDING", gatewayOrderId: order.id } });
    return { provider: "razorpay", keyId: rp.keyId, orderId: order.id, amount: order.amount, currency: order.currency, invoiceNumber: inv.number };
  }

  /** Browser hands back Razorpay's result; we trust it only if the HMAC signature verifies. */
  @Post("billing/payments/razorpay/verify")
  @HttpCode(200)
  @RequireAnyPermission(P.SELF_PORTAL, P.BILLING_MANAGE)
  async verify(@CurrentUser() user: RequestUser, @Body() dto: VerifyRazorpayDto, @Req() req: Request) {
    const rp = razorpay();
    if (!rp) throw new ServiceUnavailableException("Online payments are not configured");
    if (!isValidRazorpayPayment(rp.secret, dto.orderId, dto.paymentId, dto.signature)) throw new UnauthorizedException("Payment signature is invalid");

    const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: dto.orderId }, include: { invoice: { select: { hospitalId: true, patientId: true } } } });
    if (!payment || payment.invoice.hospitalId !== user.hospitalId) throw new NotFoundException("Payment not found");
    if (user.role === "PATIENT" && payment.invoice.patientId !== user.patientId) throw new ForbiddenException();
    return this.settleGatewayPayment(payment.id, dto.paymentId, user, req);
  }

  /** Razorpay webhook (configure in the Razorpay dashboard): the authoritative confirmation. */
  @Public()
  @Post("billing/webhooks/razorpay")
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const rp = razorpay();
    const sig = req.headers["x-razorpay-signature"];
    if (!rp?.webhookSecret || typeof sig !== "string" || !req.rawBody) throw new UnauthorizedException();
    if (!isValidWebhookSignature(rp.webhookSecret, req.rawBody, sig)) throw new UnauthorizedException();

    const event = req.body as { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; status: string } } } };
    const p = event.payload?.payment?.entity;
    if (event.event === "payment.captured" && p) {
      const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: p.order_id } });
      if (payment) await this.settleGatewayPayment(payment.id, p.id, null, req);
    }
    return { received: true };
  }

  /** Idempotent: a payment confirmed by both the browser and the webhook is counted once. */
  private async settleGatewayPayment(paymentId: string, gatewayPayId: string, user: RequestUser | null, req: Request) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status === "SUCCEEDED") {
        return { inv: await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: invoiceInclude }), fresh: false, amount: Number(payment.amount) };
      }
      const inv = await this.applyPayment(tx, payment.invoiceId, Number(payment.amount), { id: payment.id, method: "RAZORPAY", gatewayPayId });
      return { inv, fresh: true, amount: Number(payment.amount) };
    });
    if (result.fresh) {
      await this.paid(result.inv, result.amount);
      await this.audit.log({ action: "PAYMENT_ONLINE_VERIFIED", entity: `${result.inv.number} ₹${result.amount} (Razorpay ${gatewayPayId})`, entityId: result.inv.id, actor: user, hospitalId: result.inv.hospitalId, req });
    }
    return toInvoiceRow(result.inv);
  }

  /* ---------------- Insurance claims ---------------- */

  @Get("billing/claims")
  @RequirePermissions(P.CLAIMS_MANAGE)
  async claims(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.insuranceClaim.findMany({
      where: { hospitalId: hospitalOf(user) },
      include: { invoice: { select: { number: true, patient: { select: { firstName: true, lastName: true } } } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((c) => ({
      id: c.id,
      claimNo: c.claimNo,
      invoiceNumber: c.invoice.number,
      patientName: `${c.invoice.patient.firstName} ${c.invoice.patient.lastName}`,
      insurer: c.insurer,
      amount: Number(c.amount),
      submittedAt: (c.submittedAt ?? c.updatedAt).toISOString(),
      status: c.status,
    }));
  }

  @Patch("billing/claims/:id")
  @RequirePermissions(P.CLAIMS_MANAGE)
  async claimStatus(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ClaimStatusDto, @Req() req: Request) {
    const c = await this.prisma.insuranceClaim.findFirst({ where: { id, hospitalId: hospitalOf(user) }, include: { invoice: { select: { number: true, patient: { select: { firstName: true, lastName: true } } } } } });
    if (!c) throw new NotFoundException("Claim not found");
    if (!CLAIM_FLOW[c.status].includes(dto.status)) throw new BadRequestException(`Can't move a claim from ${c.status} to ${dto.status}`);
    const u = await this.prisma.insuranceClaim.update({ where: { id }, data: { status: dto.status, ...(dto.status === "SUBMITTED" ? { submittedAt: new Date() } : {}) } });
    await this.audit.log({ action: `CLAIM_${dto.status}`, entity: c.claimNo, entityId: id, actor: user, req });
    return {
      id: u.id,
      claimNo: u.claimNo,
      invoiceNumber: c.invoice.number,
      patientName: `${c.invoice.patient.firstName} ${c.invoice.patient.lastName}`,
      insurer: u.insurer,
      amount: Number(u.amount),
      submittedAt: (u.submittedAt ?? u.updatedAt).toISOString(),
      status: u.status,
    };
  }
}

@Module({ controllers: [BillingController] })
export class BillingModule {}

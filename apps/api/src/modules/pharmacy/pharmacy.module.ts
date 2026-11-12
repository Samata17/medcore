import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Module, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { allocateFifo, type MedicineBatchRow } from "@medcore/types";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import type { Request } from "express";
import type { RequestUser } from "../../common/auth-types";
import { withUniqueCode } from "../../common/codes";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../../common/decorators";
import { P } from "../../common/permissions";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { prescriptionInclude, toPrescriptionRow } from "../shared/mappers";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class PrescriptionItemDto {
  @IsUUID() medicineId: string;
  @Transform(trim) @IsString() @Length(1, 40) dosage: string;
  @Transform(trim) @IsString() @Length(1, 30) frequency: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(180) durationDays: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) instructions?: string;
  /** Sent by the UI for display; the server uses the medicine's own name. */
  @IsOptional() @IsString() @MaxLength(120) medicineName?: string;
}

class CreatePrescriptionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PrescriptionItemDto) items: PrescriptionItemDto[];
}

class ReceiveBatchDto {
  @IsUUID() medicineId: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value)) @Matches(/^[A-Z0-9-]{3,20}$/) batchNo: string;
  @IsDateString() manufacturedOn: string;
  @IsDateString() expiresOn: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0.01) unitCost: number;
  @Type(() => Number) @IsNumber() @Min(0.01) mrp: number;
  // Display-only fields the UI sends along; ignored by the server.
  @IsOptional() @IsString() medicineName?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsInt() reorderLevel?: number;
}

const toBatchRow = (b: Prisma.MedicineBatchGetPayload<{ include: { medicine: true } }>): MedicineBatchRow => ({
  id: b.id,
  medicineId: b.medicineId,
  medicineName: b.medicine.name,
  category: b.medicine.category,
  batchNo: b.batchNo,
  manufacturedOn: b.manufacturedOn.toISOString(),
  expiresOn: b.expiresOn.toISOString(),
  quantity: b.quantity,
  reorderLevel: b.medicine.reorderLevel,
  unitCost: Number(b.unitCost),
  mrp: Number(b.mrp),
});

@ApiTags("Prescriptions & pharmacy")
@ApiBearerAuth()
@Controller()
export class PharmacyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  @Post("patients/:id/prescriptions")
  @RequirePermissions(P.PRESCRIPTIONS_WRITE)
  async prescribe(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) patientId: string, @Body() dto: CreatePrescriptionDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    if (!user.doctorId) throw new ForbiddenException("Only doctors can issue prescriptions");
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true, mrn: true, firstName: true, lastName: true } });
    if (!patient) throw new NotFoundException("Patient not found");

    const ids = [...new Set(dto.items.map((i) => i.medicineId))];
    if (ids.length !== dto.items.length) throw new BadRequestException("Each medicine can appear only once");
    const meds = await this.prisma.medicine.count({ where: { id: { in: ids }, hospitalId } });
    if (meds !== ids.length) throw new BadRequestException("One or more medicines are not in this hospital's formulary");

    const rx = await withUniqueCode(
      "RX",
      (code) =>
        this.prisma.prescription.create({
          data: {
            hospitalId,
            code,
            patientId,
            doctorId: user.doctorId!,
            items: { create: dto.items.map(({ medicineName: _n, ...i }) => i) },
          },
          include: prescriptionInclude,
        }),
      5,
    );
    await this.notify.toRoles(hospitalId, ["PHARMACIST"], {
      type: "PRESCRIPTION_READY",
      title: "New prescription",
      body: `Dr. ${user.lastName} issued ${rx.code} for ${patient.firstName} ${patient.lastName}.`,
      href: "/dashboard/pharmacy/prescriptions",
    });
    await this.audit.log({ action: "PRESCRIPTION_ISSUE", entity: `${rx.code} for ${patient.mrn}`, entityId: rx.id, actor: user, req });
    return toPrescriptionRow(rx);
  }

  /** Pharmacists see the hospital queue; doctors see prescriptions they issued. */
  @Get("pharmacy/prescriptions")
  @RequireAnyPermission(P.PHARMACY_MANAGE, P.PRESCRIPTIONS_WRITE)
  async prescriptions(@CurrentUser() user: RequestUser) {
    const where: Prisma.PrescriptionWhereInput = { hospitalId: hospitalOf(user) };
    if (user.role === "DOCTOR") where.doctorId = user.doctorId ?? "none";
    const rows = await this.prisma.prescription.findMany({ where, include: prescriptionInclude, orderBy: { issuedAt: "desc" }, take: 300 });
    return rows.map(toPrescriptionRow);
  }

  /** Batches (stock). Doctors need it to search medicines; admins for low-stock alerts. */
  @Get("pharmacy/batches")
  @RequireAnyPermission(P.PHARMACY_MANAGE, P.PRESCRIPTIONS_WRITE, P.HOSPITAL_MANAGE)
  async batches(@CurrentUser() user: RequestUser) {
    const hospitalId = hospitalOf(user);
    const rows = await this.prisma.medicineBatch.findMany({ where: { medicine: { hospitalId } }, include: { medicine: true }, orderBy: [{ medicine: { name: "asc" } }, { expiresOn: "asc" }] });
    return rows.map(toBatchRow);
  }

  @Post("pharmacy/batches")
  @RequirePermissions(P.PHARMACY_MANAGE)
  async receive(@CurrentUser() user: RequestUser, @Body() dto: ReceiveBatchDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const med = await this.prisma.medicine.findFirst({ where: { id: dto.medicineId, hospitalId } });
    if (!med) throw new NotFoundException("Medicine not found");
    const mfg = new Date(dto.manufacturedOn);
    const exp = new Date(dto.expiresOn);
    if (mfg > new Date()) throw new BadRequestException("Manufacturing date can't be in the future");
    if (exp <= mfg) throw new BadRequestException("Expiry must be after the manufacturing date");
    if (exp <= new Date()) throw new BadRequestException("Expired stock can't be received");
    if (dto.mrp < dto.unitCost) throw new BadRequestException("MRP can't be lower than the unit cost");

    const b = await this.prisma.medicineBatch.create({
      data: {
        medicineId: med.id, batchNo: dto.batchNo, manufacturedOn: mfg, expiresOn: exp, quantity: dto.quantity, unitCost: dto.unitCost, mrp: dto.mrp,
        movements: { create: { type: "RECEIVED", quantity: dto.quantity, performedBy: user.id, reference: "Goods received" } },
      },
      include: { medicine: true },
    });
    await this.audit.log({ action: "STOCK_RECEIVE", entity: `${med.name} batch ${b.batchNo} × ${b.quantity}`, entityId: b.id, actor: user, req });
    return toBatchRow(b);
  }

  /**
   * Dispense a whole prescription, first-in-first-out by expiry.
   * Batch rows are locked (SELECT … FOR UPDATE) so concurrent dispensing can't oversell.
   * All lines must be fillable; partial dispensing is refused.
   */
  @Post("pharmacy/prescriptions/:id/dispense")
  @HttpCode(200)
  @RequirePermissions(P.PHARMACY_MANAGE)
  async dispense(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    const result = await this.prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.findFirst({ where: { id, hospitalId }, include: { items: { include: { medicine: true } }, patient: { select: { userId: true, firstName: true } } } });
      if (!rx) throw new NotFoundException("Prescription not found");
      if (rx.status === "DISPENSED") throw new BadRequestException("Already dispensed");
      if (rx.status === "CANCELLED") throw new BadRequestException("This prescription was cancelled");

      const medicineIds = rx.items.map((i) => i.medicineId);
      await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE "medicineId" IN (${Prisma.join(medicineIds)}) FOR UPDATE`;
      const batches = await tx.medicineBatch.findMany({ where: { medicineId: { in: medicineIds } }, include: { medicine: true } });
      const rows = batches.map(toBatchRow);

      const plan = rx.items.map((item) => {
        const need = item.quantity - item.dispensedQty;
        try {
          return { item, picks: need > 0 ? allocateFifo(rows, item.medicineId, need) : [] };
        } catch (e) {
          throw new BadRequestException(`${item.medicine.name}: ${(e as Error).message}`);
        }
      });

      const picks: string[] = [];
      for (const { item, picks: p } of plan) {
        for (const pick of p) {
          await tx.medicineBatch.update({ where: { id: pick.batchId }, data: { quantity: { decrement: pick.quantity } } });
          await tx.stockMovement.create({ data: { batchId: pick.batchId, type: "DISPENSED", quantity: -pick.quantity, reference: rx.code, performedBy: user.id } });
          picks.push(`${item.medicine.name} × ${pick.quantity} from ${pick.batchNo}`);
        }
        await tx.prescriptionItem.update({ where: { id: item.id }, data: { dispensedQty: item.quantity } });
      }
      await tx.prescription.update({ where: { id }, data: { status: "DISPENSED" } });
      return { rx, picks, medicineIds };
    });

    await this.notify.toUsers([result.rx.patient.userId], hospitalId, {
      type: "PRESCRIPTION_READY",
      title: "Your medicines are ready",
      body: `Prescription ${result.rx.code} has been dispensed. Please collect it from the pharmacy counter.`,
      href: "/dashboard/patient/records?tab=prescriptions",
    });
    await this.checkLowStock(hospitalId, result.medicineIds);
    await this.audit.log({ action: "PRESCRIPTION_DISPENSE", entity: `${result.rx.code}: ${result.picks.join("; ")}`, entityId: id, actor: user, req });
    return { code: result.rx.code, picks: result.picks };
  }

  /** Alert pharmacists and admins when sellable stock reaches the reorder level. */
  private async checkLowStock(hospitalId: string, medicineIds: string[]) {
    const meds = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
      include: { batches: { where: { expiresOn: { gt: new Date() } }, select: { quantity: true } } },
    });
    for (const m of meds) {
      const qty = m.batches.reduce((s, b) => s + b.quantity, 0);
      if (qty <= m.reorderLevel) {
        await this.notify.toRoles(hospitalId, ["PHARMACIST", "HOSPITAL_ADMIN"], {
          type: "LOW_STOCK",
          title: "Low stock",
          body: `${m.name} is at ${qty} units (reorder level ${m.reorderLevel}).`,
          href: "/dashboard/pharmacy/inventory",
        });
      }
    }
  }
}

@Module({ controllers: [PharmacyController] })
export class PharmacyModule {}

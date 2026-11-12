import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { LabPriority, Prisma } from "@prisma/client";
import { LAB_NEXT_STATUS } from "@medcore/types";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNumber, IsString, Length, MaxLength, ValidateNested } from "class-validator";
import type { Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RequestUser } from "../../common/auth-types";
import { withUniqueCode } from "../../common/codes";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../../common/decorators";
import { userNames } from "../../common/names";
import { P } from "../../common/permissions";
import { sniffFileType } from "../../common/security";
import { hospitalOf } from "../../common/tenant";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { labOrderInclude, toLabOrderRow } from "../shared/mappers";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || "uploads");
const sniff = sniffFileType;

class OrderDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value)) @IsString() @Length(2, 120) testName: string;
  @IsEnum(LabPriority) priority: LabPriority;
}

class ResultDto {
  @IsString() @Length(1, 80) parameter: string;
  @Type(() => Number) @IsNumber() value: number;
  // Units and ranges sent by the UI are ignored; the configured ranges are used.
  @IsString() @MaxLength(30) unit: string;
  @Type(() => Number) @IsNumber() refLow: number;
  @Type(() => Number) @IsNumber() refHigh: number;
}

class ResultsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ResultDto) results: ResultDto[];
}

@ApiTags("Laboratory")
@ApiBearerAuth()
@Controller()
export class LabController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  private async rows(where: Prisma.LabOrderWhereInput) {
    const orders = await this.prisma.labOrder.findMany({ where, include: labOrderInclude, orderBy: { orderedAt: "desc" }, take: 300 });
    const names = await userNames(this.prisma, orders.map((o) => o.approvedById));
    return orders.map((o) => toLabOrderRow(o, names));
  }

  private async one(user: RequestUser, id: string) {
    const o = await this.prisma.labOrder.findFirst({ where: { id, hospitalId: hospitalOf(user) }, include: labOrderInclude });
    if (!o) throw new NotFoundException("Lab order not found");
    return o;
  }

  private async row(o: Prisma.LabOrderGetPayload<{ include: typeof labOrderInclude }>) {
    return toLabOrderRow(o, await userNames(this.prisma, [o.approvedById]));
  }

  /** Test catalogue with configured reference ranges. */
  @Get("lab/tests")
  @RequireAnyPermission(P.LAB_ORDER, P.LAB_PROCESS)
  async tests(@CurrentUser() user: RequestUser) {
    const tests = await this.prisma.labTest.findMany({
      where: { hospitalId: hospitalOf(user), isActive: true },
      include: { parameters: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    return tests.map((t) => ({
      name: t.name,
      price: Number(t.price),
      parameters: t.parameters.map((p) => ({ parameter: p.name, unit: p.unit, refLow: Number(p.refLow), refHigh: Number(p.refHigh) })),
    }));
  }

  /** Lab staff see the hospital worklist; doctors see orders they placed. */
  @Get("lab/orders")
  @RequireAnyPermission(P.LAB_PROCESS, P.LAB_ORDER)
  async orders(@CurrentUser() user: RequestUser) {
    const where: Prisma.LabOrderWhereInput = { hospitalId: hospitalOf(user) };
    if (user.role === "DOCTOR") where.orderedById = user.doctorId ?? "none";
    return this.rows(where);
  }

  @Post("patients/:id/lab-orders")
  @RequirePermissions(P.LAB_ORDER)
  async order(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) patientId: string, @Body() dto: OrderDto, @Req() req: Request) {
    const hospitalId = hospitalOf(user);
    if (!user.doctorId) throw new ForbiddenException("Only doctors can order tests");
    const [patient, test] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true, mrn: true, firstName: true, lastName: true } }),
      this.prisma.labTest.findFirst({ where: { hospitalId, name: dto.testName, isActive: true } }),
    ]);
    if (!patient) throw new NotFoundException("Patient not found");
    if (!test) throw new BadRequestException("This test isn't offered by the hospital laboratory");

    const o = await withUniqueCode(
      "LAB",
      (code) =>
        this.prisma.labOrder.create({
          data: { hospitalId, code, patientId, labTestId: test.id, orderedById: user.doctorId!, priority: dto.priority },
          include: labOrderInclude,
        }),
      5,
    );
    await this.notify.toRoles(hospitalId, ["LAB_TECHNICIAN"], {
      type: "SYSTEM",
      title: dto.priority === "URGENT" ? "Urgent test order" : "New test order",
      body: `${test.name} for ${patient.firstName} ${patient.lastName} (${o.code}).`,
      href: "/dashboard/lab/orders",
    });
    await this.audit.log({ action: "LAB_ORDER_CREATE", entity: `${o.code} ${test.name} for ${patient.mrn}`, entityId: o.id, actor: user, req });
    return this.row(o);
  }

  /** ORDERED → SAMPLE_COLLECTED → PROCESSING */
  @Post("lab/orders/:id/advance")
  @HttpCode(200)
  @RequirePermissions(P.LAB_PROCESS)
  async advance(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const o = await this.one(user, id);
    const next = LAB_NEXT_STATUS[o.status];
    if (!next || next === "RESULT_ENTERED" || next === "APPROVED") throw new BadRequestException("Use result entry or approval for this step");
    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: { status: next, ...(next === "SAMPLE_COLLECTED" ? { collectedAt: new Date() } : {}) },
      include: labOrderInclude,
    });
    await this.audit.log({ action: `LAB_${next}`, entity: o.code, entityId: id, actor: user, req });
    return this.row(updated);
  }

  /** Structured results. Abnormal flags use the hospital's configured reference ranges. */
  @Post("lab/orders/:id/results")
  @HttpCode(200)
  @RequirePermissions(P.LAB_PROCESS)
  async results(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ResultsDto, @Req() req: Request) {
    const o = await this.one(user, id);
    if (o.status !== "PROCESSING" && o.status !== "RESULT_ENTERED") throw new BadRequestException("Results can only be entered while the sample is being processed");
    const params = await this.prisma.labTestParameter.findMany({ where: { labTestId: o.labTestId } });
    const byName = new Map(params.map((p) => [p.name, p]));
    const sent = new Set(dto.results.map((r) => r.parameter));
    if (sent.size !== dto.results.length || params.some((p) => !sent.has(p.name)) || dto.results.some((r) => !byName.has(r.parameter))) {
      throw new BadRequestException(`Enter exactly these parameters: ${params.map((p) => p.name).join(", ")}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.labResult.deleteMany({ where: { labOrderId: id } }); // editable until approved
      await tx.labResult.createMany({
        data: dto.results.map((r) => {
          const p = byName.get(r.parameter)!;
          const low = Number(p.refLow);
          const high = Number(p.refHigh);
          return { labOrderId: id, parameter: p.name, value: r.value, unit: p.unit, refLow: low, refHigh: high, isAbnormal: r.value < low || r.value > high, enteredById: user.id };
        }),
      });
      return tx.labOrder.update({ where: { id }, data: { status: "RESULT_ENTERED" }, include: labOrderInclude });
    });
    await this.audit.log({ action: "LAB_RESULT_ENTER", entity: o.code, entityId: id, actor: user, req });
    return this.row(updated);
  }

  /** Approval releases the report to the patient and the ordering doctor. */
  @Post("lab/orders/:id/approve")
  @HttpCode(200)
  @RequirePermissions(P.LAB_PROCESS)
  async approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const o = await this.one(user, id);
    if (o.status !== "RESULT_ENTERED" || o.results.length === 0) throw new BadRequestException("Enter results before approving");
    const updated = await this.prisma.labOrder.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id }, include: labOrderInclude });
    const abnormal = updated.results.filter((r) => r.isAbnormal).length;
    await this.notify.toUsers([o.patient.userId], o.hospitalId, {
      type: "LAB_REPORT_APPROVED",
      title: "Your lab report is ready",
      body: `${o.labTest.name} report has been approved.`,
      href: "/dashboard/patient/records?tab=lab",
    });
    await this.notify.toUsers([o.orderedBy.userId], o.hospitalId, {
      type: "LAB_REPORT_APPROVED",
      title: "Lab report approved",
      body: `${o.labTest.name} for ${o.patient.firstName} ${o.patient.lastName}${abnormal ? ` — ${abnormal} abnormal value(s)` : ""}.`,
      href: `/dashboard/doctor/patients/${o.patientId}?tab=lab`,
    });
    await this.audit.log({ action: "LAB_RESULT_APPROVE", entity: o.code, entityId: id, actor: user, req });
    return this.row(updated);
  }

  /** Attach a PDF/PNG/JPEG report (≤ 5 MB) to an order before approval. */
  @Post("lab/orders/:id/report")
  @RequirePermissions(P.LAB_PROCESS)
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException("Choose a file to upload");
    if (file.size > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException("File must be 5 MB or smaller");
    const kind = sniff(file.buffer);
    if (!kind) throw new BadRequestException("Only PDF, PNG or JPEG files are allowed");
    const o = await this.one(user, id);
    if (o.status === "APPROVED" || o.status === "CANCELLED") throw new BadRequestException("Reports can't be added after approval");

    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
    const storageKey = `${randomUUID()}.${kind.ext}`; // never use the client's file name on disk
    await writeFile(join(UPLOAD_DIR, storageKey), file.buffer, { flag: "wx" });
    const safeName = (file.originalname || `report.${kind.ext}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const a = await this.prisma.attachment.create({
      data: {
        patientId: o.patientId,
        labOrderId: id,
        fileName: safeName,
        mimeType: kind.mime,
        sizeBytes: file.size,
        storageKey,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        uploadedById: user.id,
      },
    });
    await this.audit.log({ action: "LAB_REPORT_UPLOAD", entity: `${o.code}: ${safeName}`, entityId: a.id, actor: user, req });
    return { id: a.id, fileName: a.fileName };
  }

  /** Download an attachment: hospital staff with record/lab access, or the patient once the report is approved. */
  @Get("attachments/:id")
  async download(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const a = await this.prisma.attachment.findUnique({ where: { id }, include: { patient: { select: { hospitalId: true } }, labOrder: { select: { status: true } } } });
    const staffOk = ["DOCTOR", "NURSE", "LAB_TECHNICIAN"].includes(user.role) && a?.patient.hospitalId === user.hospitalId;
    const patientOk = user.role === "PATIENT" && a?.patientId === user.patientId && a?.labOrder?.status === "APPROVED";
    if (!a || !(staffOk || patientOk)) throw new NotFoundException("File not found");
    const path = join(UPLOAD_DIR, a.storageKey);
    if (!existsSync(path)) throw new NotFoundException("File is missing from storage");
    await this.audit.log({ action: "ATTACHMENT_DOWNLOAD", entity: a.fileName, entityId: a.id, actor: user, req });
    res.setHeader("Content-Type", a.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${a.fileName.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(createReadStream(path));
  }
}

@Module({ controllers: [LabController] })
export class LabModule {}

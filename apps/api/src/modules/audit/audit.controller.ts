import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import type { RequestUser } from "../../common/auth-types";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { Paginated } from "../../common/http";
import { P } from "../../common/permissions";
import { PrismaService } from "../../prisma/prisma.service";

class AuditQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 50;
}

@ApiTags("Audit logs")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /** Super admins see every hospital; hospital admins only their own. */
  @Get()
  @RequirePermissions(P.AUDIT_READ)
  async list(@CurrentUser() user: RequestUser, @Query() q: AuditQuery) {
    const where = user.role === "SUPER_ADMIN" ? {} : { hospitalId: user.hospitalId };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { hospital: { select: { name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));
    return Paginated.of(
      rows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actor: (r.actorId && name.get(r.actorId)) || "unknown",
        actorRole: r.actorRole ?? "PATIENT",
        action: r.action,
        entity: r.entity,
        hospital: r.hospital?.name,
        ip: r.ip ?? "",
      })),
      total,
      q.page,
      q.pageSize,
    );
  }
}

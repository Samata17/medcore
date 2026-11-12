import { Controller, Get, Module, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness + database connectivity check (used by Docker and deploy platforms). */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up", time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}

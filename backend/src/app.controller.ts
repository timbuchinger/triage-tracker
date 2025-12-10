import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./database/prisma.service";
import { Public } from "./auth/decorators/public.decorator";

@Controller()
@Public()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  getHealth() {
    return {
      status: "ok",
      service: "triage-tracker-backend"
    };
  }

  @Get("db-health")
  async dbHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}

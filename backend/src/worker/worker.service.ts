import { Injectable, Logger } from "@nestjs/common";
import { EventType, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // In the future, wire this to BullMQ or another job queue
  runScheduledTasks() {
    this.logger.log("Running scheduled background tasks (placeholder).");
  }

  async recordAISummary(incidentId: string, content: string, metadata?: Prisma.InputJsonValue) {
    await this.prisma.incidentSummary.create({
      data: { incidentId, content, metadata }
    });

    await this.prisma.timelineEvent.create({
      data: {
        incidentId,
        type: EventType.AI_SUMMARY,
        metadata,
        message: content
      }
    });
  }
}

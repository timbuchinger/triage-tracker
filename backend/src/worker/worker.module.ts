import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { SlackModule } from "../slack/slack.module";
import { SlackJobProcessor } from "./slack-job.processor";
import { WorkerService } from "./worker.service";

@Module({
  imports: [PrismaModule, SlackModule],
  providers: [WorkerService, SlackJobProcessor],
  exports: [WorkerService]
})
export class WorkerModule {}

import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { AiModule } from "../ai/ai.module";
import { SlackModule } from "../slack/slack.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [PrismaModule, AiModule, forwardRef(() => SlackModule)],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService]
})
export class IncidentsModule {}

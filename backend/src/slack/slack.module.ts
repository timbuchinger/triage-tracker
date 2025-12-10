import { Module, forwardRef } from "@nestjs/common";
import { IncidentsModule } from "../incidents/incidents.module";
import { PrismaModule } from "../database/prisma.module";
import { SlackIntegrationModule } from "../integrations/slack/slack-integration.module";
import { SlackClient } from "./slack.client";
import { SLACK_CONFIG, SlackConfig } from "./slack.constants";
import { SlackIncService } from "./slack-inc.service";
import { SlackJobsService } from "./slack-jobs.service";
import { SlackQueueService } from "./slack-queue.service";
import { SlackSignatureGuard } from "./slack-signature.guard";
import { SlackController } from "./slack.controller";
import { SlackOAuthController } from "./slack-oauth.controller";
import { SlackOAuthService } from "./slack-oauth.service";

@Module({
  imports: [forwardRef(() => IncidentsModule), PrismaModule, SlackIntegrationModule],
  controllers: [SlackController, SlackOAuthController],
  providers: [
    {
      provide: SLACK_CONFIG,
      useFactory: (): SlackConfig => ({
        signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
        botToken: process.env.SLACK_BOT_TOKEN ?? ""
      })
    },
    {
      provide: SlackClient,
      inject: [SLACK_CONFIG],
      useFactory: (config: SlackConfig) => new SlackClient(config)
    },
    SlackSignatureGuard,
    {
      provide: SlackQueueService,
      inject: [SLACK_CONFIG],
      useFactory: (config: SlackConfig) => new SlackQueueService(config)
    },
    SlackIncService,
    SlackJobsService,
    SlackOAuthService
  ],
  exports: [SlackClient, SlackQueueService, SlackJobsService, SlackOAuthService, SLACK_CONFIG]
})
export class SlackModule {}

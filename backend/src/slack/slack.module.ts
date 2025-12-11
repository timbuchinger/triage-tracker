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
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";

@Module({
  imports: [forwardRef(() => IncidentsModule), PrismaModule, forwardRef(() => SlackIntegrationModule), ConfigModule],
  controllers: [SlackController, SlackOAuthController],
  providers: [
    {
      provide: SLACK_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SlackConfig => ({
        signingSecret: config.slackSigningSecret ?? "",
        botToken: config.slackBotToken ?? ""
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
  exports: [SlackClient, SlackQueueService, SlackJobsService, SlackOAuthService, SLACK_CONFIG, SlackIncService]
})
export class SlackModule {}

import { Module, forwardRef } from '@nestjs/common';
import { SlackModule } from '../../slack/slack.module';
import { ConfigModule } from '@nestjs/config';
import { SlackIntegrationController } from './slack-integration.controller';
import { SlackIntegrationService } from './slack-integration.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule, forwardRef(() => SlackModule)],
  controllers: [SlackIntegrationController],
  providers: [SlackIntegrationService],
  exports: [SlackIntegrationService],
})
export class SlackIntegrationModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackIntegrationController } from './slack-integration.controller';
import { SlackIntegrationService } from './slack-integration.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [SlackIntegrationController],
  providers: [SlackIntegrationService],
  exports: [SlackIntegrationService],
})
export class SlackIntegrationModule {}

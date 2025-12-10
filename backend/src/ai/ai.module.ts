import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { GeminiClient } from './gemini.client';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AiService, GeminiClient],
  exports: [AiService],
})
export class AiModule {}

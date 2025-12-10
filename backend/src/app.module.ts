import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { ServicesModule } from "./services/services.module";
import { TeamsModule } from "./teams/teams.module";
import { WorkerModule } from "./worker/worker.module";
import { SlackModule } from "./slack/slack.module";
import { SlackIntegrationModule } from "./integrations/slack/slack-integration.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    IncidentsModule,
    ServicesModule,
    TeamsModule,
    WorkerModule,
    SlackModule,
    SlackIntegrationModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ]
})
export class AppModule {}

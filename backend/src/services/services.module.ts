import { Module } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServiceLinksService } from "./service-links.service";
import { ServicesController } from "./services.controller";
import { PrismaModule } from "../database/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServiceLinksService],
  exports: [ServicesService, ServiceLinksService]
})
export class ServicesModule {}
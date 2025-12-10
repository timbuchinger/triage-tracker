import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { InvitesService } from './invites.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, InvitesService],
  exports: [OrganizationsService, InvitesService],
})
export class OrganizationsModule {}

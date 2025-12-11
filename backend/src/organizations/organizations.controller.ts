import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private organizationsService: OrganizationsService,
    private invitesService: InvitesService,
  ) {}

  @Get(':orgId/members')
  @UseGuards(OrganizationGuard)
  async getMembers(@Param('orgId') orgId: string, @CurrentUser() user: CurrentUserData) {
    return this.organizationsService.getMembers(orgId);
  }

  @Patch(':orgId/members/:userId/role')
  @Roles(UserRole.OWNER)
  @UseGuards(OrganizationGuard)
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.organizationsService.updateMemberRole(orgId, userId, dto, user.id);
  }

  @Delete(':orgId/members/:userId')
  @Roles(UserRole.OWNER)
  @UseGuards(OrganizationGuard)
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.organizationsService.removeMember(orgId, userId, user.id);
  }

  @Get(':orgId/invites')
  @Roles(UserRole.OWNER)
  @UseGuards(OrganizationGuard)
  async listInvites(@Param('orgId') orgId: string, @CurrentUser() user: CurrentUserData) {
    return this.invitesService.listInvites(orgId);
  }

  @Post(':orgId/invites')
  @Roles(UserRole.OWNER)
  @UseGuards(OrganizationGuard)
  async createInvite(
    @Param('orgId') orgId: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.invitesService.createInvite(orgId, dto);
  }

  @Public()
  @Post('invites/accept')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(dto);
  }
}

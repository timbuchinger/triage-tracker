import { Controller, Get, Delete, Query, Param, Post, Body, Headers, RawBodyRequest, Req, Res, UseGuards, Logger, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { SlackIntegrationService } from './slack-integration.service';
import { SlackIncService } from '../../slack/slack-inc.service';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('integrations/slack')
export class SlackIntegrationController {
  private readonly logger = new Logger(SlackIntegrationController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly slackIntegrationService: SlackIntegrationService,
    @Inject(forwardRef(() => SlackIncService))
    private readonly slackIncService: SlackIncService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  @Get('start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  async startOAuth(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    if (!organizationId || !userId) {
      return res.redirect(`${this.frontendUrl}/organization/settings?error=missing_params`);
    }

    if (user.organizationId !== organizationId || user.id !== userId) {
      return res.redirect(`${this.frontendUrl}/organization/settings?error=unauthorized`);
    }

    const url = await this.slackIntegrationService.generateOAuthUrl(organizationId, userId);
    return res.redirect(url);
  }

  @Get('user/start')
  async startUserLink(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    if (!organizationId || !userId) {
      return res.redirect(`${this.frontendUrl}/settings?error=missing_params`);
    }

    if (user.organizationId !== organizationId || user.id !== userId) {
      return res.redirect(`${this.frontendUrl}/settings?error=unauthorized`);
    }

    const url = await this.slackIntegrationService.generateUserLinkUrl(organizationId, userId);
    return res.redirect(url);
  }

  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`OAuth error: ${error}`);
      return res.redirect(`${this.frontendUrl}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${this.frontendUrl}/settings?error=missing_params`);
    }

    try {
      const result = await this.slackIntegrationService.handleCallback(code, state);
      this.logger.log(`Successfully installed Slack for org ${result.organizationId}`);
      
      // Determine redirect based on flow (state contains flow prefix)
      const redirectBase = state.startsWith('user_link:') ? '/settings' : '/organization/settings';
      return res.redirect(`${this.frontendUrl}${redirectBase}?success=slack_connected&team=${encodeURIComponent(result.teamName)}`);
    } catch (err) {
      this.logger.error('OAuth callback error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.redirect(`${this.frontendUrl}/settings?error=${encodeURIComponent(message)}`);
    }
  }

  @Get(':organizationId/status')
  async getStatus(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.debug(`getStatus called: orgId=${organizationId}, user=${JSON.stringify(user)}`);
    
    if (!user || user.organizationId !== organizationId) {
      this.logger.warn(`Unauthorized access attempt: user=${JSON.stringify(user)}, requestedOrg=${organizationId}`);
      throw new UnauthorizedException('Cannot access other organization data');
    }

    const status = await this.slackIntegrationService.getIntegrationStatus(organizationId);
    return { connected: !!status, integration: status };
  }

  @Get('user/status')
  async getUserStatus(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!organizationId || !userId) return { linked: false };
    
    if (!user || user.organizationId !== organizationId || user.id !== userId) {
      throw new UnauthorizedException('Cannot access other user data');
    }

    const mapping = await this.slackIntegrationService.getUserMappingStatus(organizationId, userId);
    return { linked: !!mapping, mapping };
  }

  @Post('user/unlink')
  async unlinkUser(
    @Body() body: { organizationId: string; userId: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    const { organizationId, userId } = body;
    if (!organizationId || !userId) return { success: false, message: 'missing_params' };
    
    if (user.organizationId !== organizationId || user.id !== userId) {
      throw new UnauthorizedException('Cannot unlink other user accounts');
    }

    await this.slackIntegrationService.unlinkUser(organizationId, userId);
    return { success: true };
  }

  @Delete(':organizationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  async uninstall(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (user.organizationId !== organizationId) {
      throw new UnauthorizedException('Cannot uninstall integration for other organizations');
    }

    await this.slackIntegrationService.uninstall(organizationId);
    return { success: true, message: 'Slack integration removed' };
  }

  @Post('events')
  @Public()
  async handleEvents(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') || JSON.stringify(body);

    if (!this.slackIntegrationService.verifySlackSignature(signature, timestamp, rawBody)) {
      this.logger.warn('Invalid Slack signature');
      return { error: 'Invalid signature' };
    }

    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    if (body.type === 'event_callback') {
      const event = body.event;

      if (event.type === 'app_uninstalled') {
        await this.slackIntegrationService.handleAppUninstalled(body.team_id);
      }

      // Log the raw event for better traceability
      this.logger.debug(`Received Slack event callback: ${JSON.stringify(event)}`);

      // Forward event payloads to the Slack incidents service for processing
      try {
        await this.slackIncService.handleEvent(body);
      } catch (err) {
        this.logger.error(`Error processing Slack event in SlackIncService: ${err}`);
      }
    }

    return { ok: true };
  }

  @Post('interactive')
  @Public()
  async handleInteractive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') || JSON.stringify(body);

    if (!this.slackIntegrationService.verifySlackSignature(signature, timestamp, rawBody)) {
      this.logger.warn('Invalid Slack signature for interactive payload');
      return { error: 'Invalid signature' };
    }

    this.logger.log('Received Slack interactive payload');
    return { ok: true };
  }
}

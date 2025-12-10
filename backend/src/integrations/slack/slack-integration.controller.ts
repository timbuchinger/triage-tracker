import { Controller, Get, Delete, Query, Param, Post, Body, Headers, RawBodyRequest, Req, Res, UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { Request, Response } from 'express';
import { SlackIntegrationService } from './slack-integration.service';
import { SlackIncService } from '../../slack/slack-inc.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('integrations/slack')
@Public()
export class SlackIntegrationController {
  private readonly logger = new Logger(SlackIntegrationController.name);

  constructor(
    private readonly slackIntegrationService: SlackIntegrationService,
    @Inject(forwardRef(() => SlackIncService))
    private readonly slackIncService: SlackIncService,
  ) {}

  @Get('start')
  async startOAuth(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    if (!organizationId || !userId) {
      return { error: 'Missing organizationId or userId' };
    }

    const url = await this.slackIntegrationService.generateOAuthUrl(organizationId, userId);
    return { url };
  }

  @Get('user/start')
  async startUserLink(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    if (!organizationId || !userId) {
      return { error: 'Missing organizationId or userId' };
    }

    const url = await this.slackIntegrationService.generateUserLinkUrl(organizationId, userId);
    return { url };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`OAuth error: ${error}`);
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect('/settings/integrations?error=missing_params');
    }

    try {
      const result = await this.slackIntegrationService.handleCallback(code, state);
      this.logger.log(`Successfully installed Slack for org ${result.organizationId}`);
      return res.redirect(`/settings/integrations?success=slack_connected&team=${encodeURIComponent(result.teamName)}`);
    } catch (err) {
      this.logger.error('OAuth callback error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(message)}`);
    }
  }

  @Get(':organizationId/status')
  async getStatus(@Param('organizationId') organizationId: string) {
    const status = await this.slackIntegrationService.getIntegrationStatus(organizationId);
    return { connected: !!status, integration: status };
  }

  @Get('user/status')
  async getUserStatus(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    if (!organizationId || !userId) return { linked: false };
    const mapping = await this.slackIntegrationService.getUserMappingStatus(organizationId, userId);
    return { linked: !!mapping, mapping };
  }

  @Post('user/unlink')
  async unlinkUser(
    @Body() body: { organizationId: string; userId: string },
  ) {
    const { organizationId, userId } = body;
    if (!organizationId || !userId) return { success: false, message: 'missing_params' };
    await this.slackIntegrationService.unlinkUser(organizationId, userId);
    return { success: true };
  }

  @Delete(':organizationId')
  async uninstall(@Param('organizationId') organizationId: string) {
    await this.slackIntegrationService.uninstall(organizationId);
    return { success: true, message: 'Slack integration removed' };
  }

  @Post('events')
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

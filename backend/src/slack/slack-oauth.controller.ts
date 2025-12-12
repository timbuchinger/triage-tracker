import { Controller, Get, Delete, Query, Param, Res, HttpStatus, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { SlackOAuthService } from './slack-oauth.service';

@Controller('slack/oauth')
export class SlackOAuthController {
  constructor(private readonly slackOAuthService: SlackOAuthService) {}

  @Get('start')
  async startOAuth(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!organizationId || !userId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing organizationId or userId',
      });
    }

    const authUrl = await this.slackOAuthService.startOAuthFlow(organizationId, userId);

    // If the client expects JSON (e.g., frontend fetch/XHR), return the URL
    // as JSON so the frontend can perform a top-level navigation. This
    // prevents fetch from following the redirect to Slack which would trigger
    // CORS issues when the browser attempts to fetch a third-party URL.
    const accept = req.headers['accept'] || '';
    const asJson =
      (typeof accept === 'string' && accept.includes('application/json')) ||
      req.query?.format === 'json';

    if (asJson) {
      return res.json({ url: authUrl });
    }

    return res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.redirect(`/organization/settings?error=missing_parameters`);
    }

    try {
      const result = await this.slackOAuthService.handleCallback(code, state);
      return res.redirect(`/organization/settings?success=true&team=${encodeURIComponent(result.teamName)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`/organization/settings?error=${encodeURIComponent(message)}`);
    }
  }

  @Get(':organizationId/status')
  async getStatus(@Param('organizationId') organizationId: string) {
    const status = await this.slackOAuthService.getIntegrationStatus(organizationId);
    return { integration: status };
  }

  @Delete(':organizationId')
  async unlink(@Param('organizationId') organizationId: string) {
    await this.slackOAuthService.unlinkIntegration(organizationId);
    return { message: 'Integration unlinked successfully' };
  }
}

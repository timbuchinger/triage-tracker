import { Controller, Get, Delete, Query, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SlackOAuthService } from './slack-oauth.service';

@Controller('integrations/slack')
export class SlackOAuthController {
  constructor(private readonly slackOAuthService: SlackOAuthService) {}

  @Get('start')
  async startOAuth(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    if (!organizationId || !userId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing organizationId or userId',
      });
    }

    const authUrl = await this.slackOAuthService.startOAuthFlow(organizationId, userId);
    return res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.redirect(`/settings/integrations?error=missing_parameters`);
    }

    try {
      const result = await this.slackOAuthService.handleCallback(code, state);
      return res.redirect(`/settings/integrations?success=true&team=${encodeURIComponent(result.teamName)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(message)}`);
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

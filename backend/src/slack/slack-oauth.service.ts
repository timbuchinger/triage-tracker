import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SlackOAuthService {
  private readonly logger = new Logger(SlackOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly prisma: PrismaService) {
    this.clientId = process.env.SLACK_CLIENT_ID || '';
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || '';
    this.redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/api/integrations/slack/callback';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured');
    }
  }

  async startOAuthFlow(organizationId: string, userId: string): Promise<string> {
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oAuthState.create({
      data: {
        state,
        organizationId,
        userId,
        expiresAt,
      },
    });

    const scopes = [
      'chat:write',
      'chat:write.public',
      'commands',
      'channels:read',
      'groups:read',
      'users:read',
      'reactions:read',
      'channels:history',
      'groups:history',
    ].join(',');

    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('state', state);

    return authUrl.toString();
  }

  async handleCallback(code: string, state: string): Promise<{ organizationId: string; teamName: string }> {
    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    if (oauthState.expiresAt < new Date()) {
      await this.prisma.oAuthState.delete({ where: { id: oauthState.id } });
      throw new BadRequestException('OAuth state expired');
    }

    const tokenResponse = await this.exchangeCodeForToken(code);

    const existing = await this.prisma.slackIntegration.findFirst({
      where: { organizationId: oauthState.organizationId },
    });

    if (existing) {
      await this.prisma.slackIntegration.update({
        where: { id: existing.id },
        data: {
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          botToken: tokenResponse.access_token,
          userToken: tokenResponse.authed_user?.access_token,
          scopes: tokenResponse.scope,
          installedByUserId: oauthState.userId,
          installedAt: new Date(),
          active: true,
          metadata: tokenResponse,
          lastEventAt: new Date(),
        },
      });
    } else {
      await this.prisma.slackIntegration.create({
        data: {
          organizationId: oauthState.organizationId,
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          botToken: tokenResponse.access_token,
          userToken: tokenResponse.authed_user?.access_token,
          scopes: tokenResponse.scope,
          installedByUserId: oauthState.userId,
          active: true,
          metadata: tokenResponse,
        },
      });
    }

    await this.prisma.oAuthState.delete({ where: { id: oauthState.id } });

    this.logger.log(`Slack integration installed for org ${oauthState.organizationId}`);

    return {
      organizationId: oauthState.organizationId,
      teamName: tokenResponse.team.name,
    };
  }

  async getIntegrationStatus(organizationId: string) {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { organizationId, active: true },
      include: {
        installedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!integration) {
      return null;
    }

    return {
      teamId: integration.teamId,
      teamName: integration.teamName,
      scopes: integration.scopes.split(','),
      installedBy: integration.installedBy,
      installedAt: integration.installedAt,
      active: integration.active,
    };
  }

  async unlinkIntegration(organizationId: string): Promise<void> {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { organizationId, active: true },
    });

    if (!integration) {
      throw new NotFoundException('No active Slack integration found');
    }

    await this.prisma.slackIntegration.update({
      where: { id: integration.id },
      data: { active: false },
    });

    this.logger.log(`Slack integration unlinked for org ${organizationId}`);
  }

  async handleAppUninstalled(teamId: string): Promise<void> {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { teamId },
    });

    if (integration) {
      await this.prisma.slackIntegration.update({
        where: { id: integration.id },
        data: { active: false },
      });

      this.logger.log(`Slack app uninstalled for team ${teamId}`);
    }
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      this.logger.error(`OAuth token exchange failed: ${data.error}`);
      throw new BadRequestException(`Failed to exchange code for token: ${data.error}`);
    }

    return data;
  }
}

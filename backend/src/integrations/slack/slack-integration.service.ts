import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHmac, createCipheriv, createDecipheriv } from 'crypto';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
  };
  error?: string;
}

@Injectable()
export class SlackIntegrationService {
  private readonly logger = new Logger(SlackIntegrationService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly signingSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('SLACK_CLIENT_ID') || '';
    this.clientSecret = this.config.get<string>('SLACK_CLIENT_SECRET') || '';
    this.signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET') || '';
    this.redirectUri = this.config.get<string>('SLACK_REDIRECT_URI') || 'http://localhost:3000/api/integrations/slack/callback';
  }

  async generateOAuthUrl(organizationId: string, userId: string, flow = 'install'): Promise<string> {
    const state = `${flow}:${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oAuthState.create({
      data: {
        state,
        organizationId,
        userId,
        flow,
        expiresAt,
      },
    });

    const scopes = [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read',
      'users:read',
      'commands',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<{ teamName: string; organizationId: string }> {
    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      throw new UnauthorizedException('Invalid state parameter');
    }

    if (new Date() > oauthState.expiresAt) {
      await this.prisma.oAuthState.delete({ where: { state } });
      throw new UnauthorizedException('State parameter expired');
    }

    const tokenResponse = await this.exchangeCodeForToken(code);

    if (!tokenResponse.ok) {
      throw new BadRequestException(tokenResponse.error || 'Failed to exchange code for token');
    }

    // Branch by flow: installation vs per-user link
    const flow = (oauthState as any).flow || 'install';

    if (flow === 'install') {
      if (!tokenResponse.access_token || !tokenResponse.team) {
        throw new BadRequestException(tokenResponse.error || 'Failed to exchange code for token');
      }

      await this.prisma.slackIntegration.upsert({
        where: { organizationId: oauthState.organizationId },
        update: {
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          botToken: this.encryptToken(tokenResponse.access_token),
          userToken: tokenResponse.authed_user?.access_token
            ? this.encryptToken(tokenResponse.authed_user.access_token)
            : null,
          scopes: tokenResponse.scope || '',
          installedByUserId: oauthState.userId,
          installedAt: new Date(),
          active: true,
          metadata: tokenResponse as any,
          lastEventAt: null,
        },
        create: {
          organizationId: oauthState.organizationId,
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          botToken: this.encryptToken(tokenResponse.access_token),
          userToken: tokenResponse.authed_user?.access_token
            ? this.encryptToken(tokenResponse.authed_user.access_token)
            : null,
          scopes: tokenResponse.scope || '',
          installedByUserId: oauthState.userId,
          active: true,
          metadata: tokenResponse as any,
        },
      });

      this.logger.log(`Slack integration installed for org ${oauthState.organizationId} (team: ${tokenResponse.team?.name})`);

      await this.prisma.oAuthState.delete({ where: { state } });

      return {
        teamName: tokenResponse.team.name,
        organizationId: oauthState.organizationId,
      };
    }

    // user_link flow: create/update SlackUserMapping
    if (flow === 'user_link') {
      const slackUserId = tokenResponse.authed_user?.id;

      if (!slackUserId) {
        throw new BadRequestException('Failed to retrieve Slack user id from OAuth response');
      }

      const integration = await this.prisma.slackIntegration.findUnique({ where: { organizationId: oauthState.organizationId } });

      if (!integration || !integration.active) {
        throw new BadRequestException('Slack integration not configured for organization');
      }

      await this.prisma.slackUserMapping.upsert({
        where: { userId_slackIntegrationId: { userId: oauthState.userId, slackIntegrationId: integration.id } },
        update: {
          slackUserId,
          linkedAt: new Date(),
        },
        create: {
          userId: oauthState.userId,
          slackIntegrationId: integration.id,
          slackUserId,
        },
      });

      await this.prisma.oAuthState.delete({ where: { state } });

      return { teamName: integration.teamName, organizationId: oauthState.organizationId };
    }

    throw new BadRequestException('Unknown OAuth flow');
  }

  async getIntegrationStatus(organizationId: string) {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { organizationId },
      include: {
        installedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!integration || !integration.active) {
      return null;
    }

    return {
      teamId: integration.teamId,
      teamName: integration.teamName,
      scopes: integration.scopes.split(','),
      installedBy: integration.installedBy,
      installedAt: integration.installedAt,
      lastEventAt: integration.lastEventAt,
      active: integration.active,
    };
  }

  async generateUserLinkUrl(organizationId: string, userId: string): Promise<string> {
    return this.generateOAuthUrl(organizationId, userId, 'user_link');
  }

  async getUserMappingStatus(organizationId: string, userId: string) {
    const integration = await this.prisma.slackIntegration.findUnique({ where: { organizationId } });
    if (!integration) return null;

    const mapping = await this.prisma.slackUserMapping.findUnique({
      where: { userId_slackIntegrationId: { userId, slackIntegrationId: integration.id } },
    });

    if (!mapping) return null;
    return { slackUserId: mapping.slackUserId, linkedAt: mapping.linkedAt };
  }

  async unlinkUser(organizationId: string, userId: string) {
    const integration = await this.prisma.slackIntegration.findUnique({ where: { organizationId } });
    if (!integration) return;

    await this.prisma.slackUserMapping.deleteMany({ where: { userId, slackIntegrationId: integration.id } });
  }

  async uninstall(organizationId: string): Promise<void> {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Slack integration not found');
    }

    await this.prisma.slackIntegration.update({
      where: { organizationId },
      data: {
        active: false,
        botToken: '',
        userToken: null,
      },
    });

    this.logger.log(`Slack integration uninstalled for org ${organizationId}`);
  }

  async handleAppUninstalled(teamId: string): Promise<void> {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { teamId },
    });

    if (integration) {
      await this.prisma.slackIntegration.update({
        where: { id: integration.id },
        data: {
          active: false,
          botToken: '',
          userToken: null,
        },
      });

      this.logger.log(`Slack app uninstalled by user for team ${teamId}`);
    }
  }

  verifySlackSignature(signature: string, timestamp: string, body: string): boolean {
    const time = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);

    if (Math.abs(currentTime - time) > 60 * 5) {
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature = 'v0=' + createHmac('sha256', this.signingSecret)
      .update(sigBasestring)
      .digest('hex');

    return mySignature === signature;
  }

  private async exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    return response.json();
  }

  private encryptToken(token: string): string {
    const appSecret = this.config.get<string>('APP_SECRET') || '';
    if (!appSecret) {
      // fallback to base64 marker for tests/dev
      return `encrypted:${Buffer.from(token).toString('base64')}`;
    }

    const key = createHmac('sha256', appSecret).digest().slice(0, 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
  }

  private decryptToken(encryptedToken: string): string {
    const appSecret = this.config.get<string>('APP_SECRET') || '';
    if (!appSecret) {
      if (encryptedToken.startsWith('encrypted:')) {
        return Buffer.from(encryptedToken.substring(10), 'base64').toString('utf-8');
      }
      return encryptedToken;
    }

    if (!encryptedToken.startsWith('enc:')) {
      return encryptedToken;
    }

    const parts = encryptedToken.split(':');
    if (parts.length !== 4) return encryptedToken;
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const key = createHmac('sha256', appSecret).digest().slice(0, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  async getBotToken(organizationId: string): Promise<string | null> {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { organizationId, active: true },
    });

    if (!integration) {
      return null;
    }

    return this.decryptToken(integration.botToken);
  }
}

import { Injectable, Logger, Optional } from "@nestjs/common";
import { SlackClient } from "./slack.client";
import { PrismaService } from "../database/prisma.service";
import { SlackIntegrationService } from "../integrations/slack/slack-integration.service";

@Injectable()
export class SlackJobsService {
  private readonly logger = new Logger(SlackJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slackIntegrationService: SlackIntegrationService,
    // Optional factory to create SlackClient instances (used in tests)
    @Optional()
    private readonly clientFactory?: (config: { signingSecret: string; botToken: string }) => SlackClient,
  ) {}

  async createIncidentChannelAndAnnounce(params: {
    refId: string;
    title: string;
    createdAt: Date | string;
    service?: string;
    reporterId: string; // app user id
    organizationId?: string;
  }) {
    const orgId = params.organizationId;
    let client: SlackClient | undefined;
    let integrationId: string | undefined;

    if (orgId) {
      const integration = await this.prisma.slackIntegration.findUnique({ where: { organizationId: orgId } });
      if (integration && integration.active) {
        integrationId = integration.id;
        const botToken = await this.slackIntegrationService.getBotToken(orgId);
        if (botToken) {
          client = this.clientFactory ? this.clientFactory({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken }) : new SlackClient({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken });
        }
      }
    }

    // Fallback to global bot token if per-org token not available
    if (!client) {
      const botToken = process.env.SLACK_BOT_TOKEN ?? '';
      client = this.clientFactory ? this.clientFactory({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken }) : new SlackClient({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken });
    }

    const channelName = `${params.refId}-${this.formatDate(params.createdAt)}`.toLowerCase();
    const channel = await client.createChannel(channelName);

    // find mapping from app user to slack user id
    let slackUserId: string | undefined;
    try {
      if (integrationId) {
        const mapping = await this.prisma.slackUserMapping.findUnique({
          where: { userId_slackIntegrationId: { userId: params.reporterId, slackIntegrationId: integrationId } }
        });
        if (mapping) slackUserId = mapping.slackUserId;
      }
    } catch (err) {
      this.logger.warn(`Failed to lookup Slack user mapping for ${params.reporterId}: ${err}`);
    }

    if (slackUserId) {
      try {
        await client.inviteUsers(channel.channel.id, [slackUserId]);
      } catch (err) {
        this.logger.warn(`Failed to invite Slack user ${slackUserId} to ${channel.channel.id}: ${err}`);
      }
    }

    await client.setChannelTopic(channel.channel.id, params.title);

    const summaryText = this.buildCreateSummary(params.refId, params.title, params.service, slackUserId ?? params.reporterId);
    const posted = await client.postMessage({
      channel: channel.channel.id,
      text: summaryText
    });

    return {
      channelId: channel.channel.id,
      channelName: channel.channel.name,
      messageTs: posted.ts
    };
  }

  async postStatusUpdateMessage(params: {
    channelId: string;
    refId: string;
    status: string;
    statusText: string;
    userName?: string;
  }) {
    // use global client for simple posts (fallback)
    const botToken = process.env.SLACK_BOT_TOKEN ?? '';
    const client = this.clientFactory ? this.clientFactory({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken }) : new SlackClient({ signingSecret: process.env.SLACK_SIGNING_SECRET ?? '', botToken });

    // Format message according to standardized format
    const messageText = params.userName
      ? `Status update from ${params.userName}: ${params.statusText}`
      : `Status for ${params.refId} set to ${params.status} — ${params.statusText}`;

    return client.postMessage({
      channel: params.channelId,
      text: messageText
    });
  }

  private formatDate(date?: Date | string) {
    const d = date instanceof Date ? date : new Date(date ?? Date.now());
    return d.toISOString().split("T")[0];
  }

  private buildCreateSummary(refId: string, title: string, service: string | undefined, slackUserId: string) {
    const serviceLine = service ? `Service: ${service}\n` : "";
    return `Incident ${refId}\n${title}\n${serviceLine}Reported by <@${slackUserId}>`;
  }
}

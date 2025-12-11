import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SlackClient } from '../slack/slack.client';
import { ReactionEventJob, SLACK_QUEUE_NAME } from '../slack/slack-queue.service';

@Processor(SLACK_QUEUE_NAME)
export class SlackReactionProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackReactionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slackClient: SlackClient,
  ) {
    super();
  }

  async process(job: Job<ReactionEventJob>): Promise<void> {
    if (job.name !== 'reaction-added') {
      return;
    }

    const { channelId, messageTs, userId } = job.data;

    this.logger.log(`Processing reaction for channel ${channelId}, message ${messageTs}`);

    const incident = await this.prisma.incident.findFirst({
      where: { slackChannelId: channelId }
    });

    if (!incident) {
      this.logger.debug(`Channel ${channelId} is not linked to an incident`);
      return;
    }

    const existingEvent = await this.prisma.timelineEvent.findFirst({
      where: {
        incidentId: incident.id,
        slackTs: messageTs
      }
    });

    if (existingEvent) {
      this.logger.debug(`Message ${messageTs} already captured in timeline`);
      return;
    }

    const message = await this.slackClient.fetchMessage(channelId, messageTs);

    if (!message) {
      this.logger.warn(`Could not fetch message ${messageTs} from channel ${channelId}`);
      return;
    }

    // Resolve mentions in the message text and fetch readable author name when possible
    const resolvedText = await this.slackClient.resolveUserNamesInText((message as any).text);
    let authorName: string | undefined = undefined;
    if ((message as any).user) {
      try {
        const u = await this.slackClient.fetchUser((message as any).user);
        authorName = u?.profile?.display_name || u?.real_name || u?.name || (message as any).user;
      } catch (_) {
        authorName = (message as any).user;
      }
    }

    await this.prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        type: EventType.MESSAGE,
        timestamp: new Date(parseFloat(messageTs) * 1000),
        message: resolvedText || (message.text || ''),
        slackTs: messageTs,
        slackUser: authorName ?? (message.user as string | undefined) ?? null,
        metadata: {
          reactions: message.reactions || [],
          permalink: message.permalink,
          capturedBy: 'thumbs-up-tracker',
        }
      }
    });

    this.logger.log(`Captured message for incident ${incident.refId}`);
  }
}

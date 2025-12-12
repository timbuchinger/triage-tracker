import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventType } from "@prisma/client";
import { Worker } from "bullmq";
import { PrismaService } from "../database/prisma.service";
import { SLACK_QUEUE_NAME, CreateIncidentJob, StatusUpdateJob, ReactionEventJob } from "../slack/slack-queue.service";
import { SlackJobsService } from "../slack/slack-jobs.service";
import { SlackClient } from "../slack/slack.client";

type JobData = CreateIncidentJob | StatusUpdateJob | ReactionEventJob;

@Injectable()
export class SlackJobProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackJobProcessor.name);
  private worker?: Worker<JobData>;

  constructor(
    private readonly slackJobs: SlackJobsService,
    private readonly prisma: PrismaService,
    private readonly slackClient: SlackClient,
  ) {}

  async onModuleInit() {
    this.worker = new Worker<JobData>(
      SLACK_QUEUE_NAME,
      async (job) => {
        this.logger.log(`Picked up job ${job.name}`);
        if (job.name === "create-incident-channel") {
          const data = job.data as CreateIncidentJob;
          this.logger.log(`Processing create-incident-channel for ${data.refId}`);
          await this.handleCreateIncidentJob(data);
          this.logger.log(`Completed create-incident-channel for ${data.refId}`);
        } else if (job.name === "post-status-update") {
          const data = job.data as StatusUpdateJob;
          this.logger.log(`Processing post-status-update for ${data.refId} (channel ${data.channelId})`);
          await this.slackJobs.postStatusUpdateMessage({
            channelId: data.channelId,
            refId: data.refId,
            status: data.status,
            statusText: data.statusText,
            userName: (data as any).userName
          });
          this.logger.log(`Completed post-status-update for ${data.refId}`);
        } else if (job.name === "reaction-added") {
          const data = job.data as ReactionEventJob;
          this.logger.log(`Processing reaction-added for channel ${data.channelId}, message ${data.messageTs}`);
          await this.handleReactionAdded(data);
          this.logger.log(`Completed reaction-added for message ${data.messageTs}`);
        } else if (job.name === "reaction-removed") {
          const data = job.data as ReactionEventJob;
          this.logger.log(`Processing reaction-removed for channel ${data.channelId}, message ${data.messageTs}`);
          await this.handleReactionRemoved(data);
          this.logger.log(`Completed reaction-removed for message ${data.messageTs}`);
        }
      },
      {
        connection: this.parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379")
      }
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.name} failed: ${err?.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handleCreateIncidentJob(data: CreateIncidentJob) {
    const result = await this.slackJobs.createIncidentChannelAndAnnounce({
      refId: data.refId,
      title: data.title,
      createdAt: data.createdAt,
      service: data.service,
      reporterId: data.reporterId,
      organizationId: (data as any).organizationId
    });

    const incident = await this.prisma.incident.findUnique({ where: { refId: data.refId } });
    if (!incident) {
      return;
    }

    // Persist the slack channel id and name on the incident
    try {
      await this.prisma.incident.update({
        where: { id: incident.id },
        data: { slackChannelId: result.channelId, slackChannelName: result.channelName }
      });
    } catch (err) {
      this.logger.warn(`Failed to update incident ${data.refId} with slack channel info: ${err}`);
    }

    await this.prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        type: EventType.ALERT,
        message: `Incident created via Slack by <@${data.reporterId}>`,
        slackUser: data.reporterId,
        slackTs: result.messageTs,
        metadata: {
          slackChannelId: result.channelId,
          slackChannelName: result.channelName,
          service: data.service
        }
      }
    });
  }

  private async handleReactionAdded(data: ReactionEventJob) {
    const { channelId, messageTs, userId } = data;

    const incident = await this.prisma.incident.findFirst({
      where: { slackChannelId: channelId }
    });

    if (!incident) {
      this.logger.debug(`Channel ${channelId} is not linked to an incident`);
      return;
    }

    // Fetch the message from Slack first so we can compute thumbs info regardless
    const message = await this.slackClient.fetchMessage(channelId, messageTs);

    if (!message) {
      this.logger.warn(`Could not fetch message ${messageTs} from channel ${channelId}`);
      return;
    }

    const existingEvent = await this.prisma.timelineEvent.findFirst({
      where: {
        incidentId: incident.id,
        slackTs: messageTs
      }
    });

    // compute thumbsCount from message.reactions if available
    let thumbsCount = 0;
    if (message && Array.isArray((message as any).reactions)) {
      const thumb = ((message as any).reactions as any[]).find((r: any) => r.name === '+1' || r.name === 'thumbsup');
      if (thumb) {
        if (typeof thumb.count === 'number') thumbsCount = thumb.count;
        else if (Array.isArray(thumb.users)) thumbsCount = thumb.users.length;
      }
    }

    if (existingEvent) {
      // Update existing timeline event metadata and thumbsCount
      const existingMetaObj = (existingEvent.metadata && typeof existingEvent.metadata === 'object') ? (existingEvent.metadata as any) : {};
      const newMeta = Object.assign({}, existingMetaObj, { reactions: (message as any).reactions || [], permalink: (message as any).permalink });

      // If this event now has thumbs, mark it as HIGHLIGHTED_MESSAGE
      const updateData: any = { metadata: newMeta, thumbsCount };
      if (thumbsCount > 0 && existingEvent.type !== EventType.HIGHLIGHTED_MESSAGE) {
        updateData.type = EventType.HIGHLIGHTED_MESSAGE;
      }

      await this.prisma.timelineEvent.update({
        where: { id: existingEvent.id },
        data: updateData
      });

      this.logger.log(`Updated highlighted message metadata for incident ${incident.refId} timeline`);
      this.logger.log(`Updated message metadata for incident ${incident.refId} timeline`);
      return;
    }

    // Create a new timeline event
    // Resolve user mentions in the message text to human-readable names
    const resolvedText = await this.slackClient.resolveUserNamesInText((message as any).text);
    // Try to resolve the message author to a display name
    let authorName: string | undefined = undefined;
    if ((message as any).user) {
      try {
        const u = await this.slackClient.fetchUser((message as any).user);
        authorName = u?.profile?.display_name || u?.real_name || u?.name || (message as any).user;
      } catch (_) {
        authorName = (message as any).user;
      }
    }

    // Try to resolve the reacting user to a display name
    let reactorName: string | undefined = undefined;
    if (userId) {
      try {
        const u = await this.slackClient.fetchUser(userId);
        reactorName = u?.profile?.display_name || u?.real_name || u?.name || userId;
      } catch (_) {
        reactorName = userId;
      }
    }

    await this.prisma.timelineEvent.create({
      // Prisma client types may be out of sync in tests; cast to any to avoid type errors until client is regenerated
      data: ({
        incidentId: incident.id,
        type: EventType.HIGHLIGHTED_MESSAGE,
        timestamp: new Date(parseFloat(messageTs) * 1000),
        message: resolvedText || (message.text || ''),
        slackTs: messageTs,
        slackUser: authorName ?? (message.user as string | undefined) ?? null,
        metadata: {
          reactions: (message as any).reactions || [],
          permalink: (message as any).permalink,
          capturedBy: reactorName ?? userId
        },
        thumbsCount
      } as any)
    });

    this.logger.log(`Added message to incident ${incident.refId} timeline`);
  }

  private async handleReactionRemoved(data: ReactionEventJob) {
    const { channelId, messageTs } = data;

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
        type: EventType.MESSAGE,
        slackTs: messageTs
      }
    });

    if (!existingEvent) {
      this.logger.debug(`Message ${messageTs} not found in timeline`);
      return;
    }

    // Try to fetch the latest message from Slack to see if any thumbs-up reactions remain.
    const message = await this.slackClient.fetchMessage(channelId, messageTs);

    if (message && Array.isArray(message.reactions)) {
      const thumb = (message.reactions as any[]).find((r: any) => r.name === '+1' || r.name === 'thumbsup');
      const hasThumbs = !!(thumb && ((thumb.count && thumb.count > 0) || (Array.isArray(thumb.users) && thumb.users.length > 0)));

      if (hasThumbs) {
        // Update stored metadata with the latest reaction info and keep the timeline event.
        const existingMetaObj = (existingEvent.metadata && typeof existingEvent.metadata === 'object') ? (existingEvent.metadata as any) : {};
          const newMeta = Object.assign({}, existingMetaObj, { reactions: message.reactions, permalink: message.permalink });
          // compute thumbsCount
          let newThumbs = 0;
          const thumbObj = ((message as any).reactions as any[]).find((r: any) => r.name === '+1' || r.name === 'thumbsup');
          if (thumbObj) {
            if (typeof thumbObj.count === 'number') newThumbs = thumbObj.count;
            else if (Array.isArray(thumbObj.users)) newThumbs = thumbObj.users.length;
          }

          await this.prisma.timelineEvent.update({
            where: { id: existingEvent.id },
            data: ({ metadata: newMeta, thumbsCount: newThumbs } as any)
          });

        this.logger.log(`Timeline event for message ${messageTs} still has thumbs; updated metadata for incident ${incident.refId}`);
        return;
      }
    }

    // If we couldn't fetch the message, fall back to stored metadata (if any).
    if (!message) {
      const storedMeta = (existingEvent.metadata && typeof existingEvent.metadata === 'object') ? (existingEvent.metadata as any) : null;
      if (storedMeta && Array.isArray(storedMeta.reactions)) {
        const storedReacts = storedMeta.reactions as any[];
        const storedThumb = storedReacts.find((r: any) => r.name === '+1' || r.name === 'thumbsup');
        const storedHasThumbs = !!(storedThumb && ((storedThumb.count && storedThumb.count > 0) || (Array.isArray(storedThumb.users) && storedThumb.users.length > 0)));
        if (storedHasThumbs) {
          this.logger.debug(`Stored metadata indicates message ${messageTs} still has thumbs; not removing`);
          return;
        }
      }
    }

    // No thumbs remain — remove the timeline event
    await this.prisma.timelineEvent.delete({
      where: { id: existingEvent.id }
    });

    this.logger.log(`Removed message from incident ${incident.refId} timeline`);
  }

  private parseRedisUrl(url: string) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined
    };
  }
}

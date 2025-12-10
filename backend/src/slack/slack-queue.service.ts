import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { SlackConfig } from "./slack.constants";

export const SLACK_QUEUE_NAME = "slack-jobs";

export type CreateIncidentJob = {
  refId: string;
  title: string;
  createdAt: string;
  service?: string;
  reporterId: string; // app user id
  organizationId?: string;
};

export type StatusUpdateJob = {
  channelId: string;
  refId: string;
  status: string;
  statusText: string;
};

export type ReactionEventJob = {
  channelId: string;
  messageTs: string;
  userId: string;
  reaction: string;
  eventTs: string;
};

@Injectable()
export class SlackQueueService {
  private readonly logger = new Logger(SlackQueueService.name);
  private readonly queue: Queue;

  constructor(config: SlackConfig) {
    this.queue = new Queue(SLACK_QUEUE_NAME, {
      connection: this.parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379")
    });
  }

  enqueueCreateIncident(job: CreateIncidentJob) {
    this.logger.log(`Enqueue create-incident-channel for ${job.refId}`);
    return this.queue.add("create-incident-channel", job, { removeOnComplete: true });
  }

  enqueueStatusUpdate(job: StatusUpdateJob) {
    this.logger.log(`Enqueue post-status-update for ${job.refId}`);
    return this.queue.add("post-status-update", job, { removeOnComplete: true });
  }

  queueReactionEvent(job: ReactionEventJob) {
    this.logger.log(`Enqueue reaction-added for channel ${job.channelId}`);
    return this.queue.add("reaction-added", job, { removeOnComplete: true });
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

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventType } from "@prisma/client";
import { Worker } from "bullmq";
import { PrismaService } from "../database/prisma.service";
import { SLACK_QUEUE_NAME, CreateIncidentJob, StatusUpdateJob } from "../slack/slack-queue.service";
import { SlackJobsService } from "../slack/slack-jobs.service";

type JobData = CreateIncidentJob | StatusUpdateJob;

@Injectable()
export class SlackJobProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackJobProcessor.name);
  private worker?: Worker<JobData>;

  constructor(private readonly slackJobs: SlackJobsService, private readonly prisma: PrismaService) {}

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
            statusText: data.statusText
          });
          this.logger.log(`Completed post-status-update for ${data.refId}`);
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

  private parseRedisUrl(url: string) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined
    };
  }
}

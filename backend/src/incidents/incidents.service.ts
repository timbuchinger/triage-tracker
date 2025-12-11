import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { EventType, Status } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AddEventDto } from "./dto/add-event.dto";
import { AddSummaryDto } from "./dto/add-summary.dto";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AiService } from "../ai/ai.service";
import { SlackQueueService } from "../slack/slack-queue.service";

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly slackQueue?: SlackQueueService,
  ) {}

  findAll(filters?: { statuses?: (keyof typeof Status)[] | any[]; dateRange?: "7" | "30" | "90" | "all"; ownerId?: string | undefined }) {
    const where: any = {};

    if (filters?.statuses && filters.statuses.length) {
      where.status = { in: filters.statuses };
    }

    if (filters?.dateRange && filters.dateRange !== "all") {
      const days = Number(filters.dateRange);
      if (!Number.isNaN(days)) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.createdAt = { gte: since };
      }
    }

    if (filters?.ownerId) {
      // assumes incidents have a reporterId or ownerId field; try common fields
      where.OR = [
        { reporterId: filters.ownerId },
        { ownerId: filters.ownerId },
      ];
    }

    return this.prisma.incident.findMany({
      where,
      include: {
        service: true,
        team: {
          include: {
            primaryContact: { select: { id: true, name: true, email: true } },
            secondaryContact: { select: { id: true, name: true, email: true } }
          }
        },
        owner: true,
        creator: true,
        reporter: true,
      },
      orderBy: { createdAt: "desc" }
    });
  }

  findOne(refId: string) {
    return this.prisma.incident.findUnique({
      where: { refId },
      include: {
        service: true,
        team: {
          include: {
            primaryContact: { select: { id: true, name: true, email: true } },
            secondaryContact: { select: { id: true, name: true, email: true } }
          }
        },
        owner: true,
        creator: true,
        reporter: true,
        timeline: { orderBy: { timestamp: "asc" } },
        summaries: true
      }
    });
  }

  async update(refId: string, dto: UpdateIncidentDto) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.serviceId !== undefined) data.serviceId = dto.serviceId;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes;

    return this.prisma.incident.update({
      where: { refId },
      data
    });
  }

  async create(dto: CreateIncidentDto, creatorId?: string) {
    // Generate a sequential incident reference id in the form INC-0001, INC-0002, ...
    // Prefer using an interactive transaction to reduce race between selecting max and creating.
    if (typeof this.prisma.$transaction === 'function') {
      const incident = await this.prisma.$transaction(async (tx) => {
        // Use a Postgres sequence for generating incident numbers to avoid
        // race conditions when many incidents are created concurrently.
        // If the sequence doesn't exist yet, create it starting at 1.
        await tx.$executeRaw`CREATE SEQUENCE IF NOT EXISTS incident_ref_seq START 1`;

        // NOTE: If you have existing incidents with high refIds, run the
        // following SQL once to align the sequence to the current max:
        //
        //   SELECT setval('incident_ref_seq', (
        //     SELECT COALESCE(MAX((regexp_replace("refId", '^INC-', ''))::int), 0) FROM "Incident" WHERE "refId" LIKE 'INC-%'
        //   ));

        // Get next sequence value
        const nextRow: Array<{ next: number } & Record<string, any>> = await tx.$queryRaw`
          SELECT nextval('incident_ref_seq') as next
        `;

        const next = Number(nextRow?.[0]?.next ?? 1);
        const refId = `INC-${String(next).padStart(4, "0")}`;

        // Determine team and owner based on service
        let teamId: string | undefined;
        let ownerId: string | undefined;
        let service: any;

        if (dto.serviceId) {
          service = await tx.service.findUnique({
            where: { id: dto.serviceId },
            include: {
              team: {
                include: {
                  primaryContact: true,
                  secondaryContact: true
                }
              }
            }
          });

          if (service?.team) {
            teamId = service.team.id;
            ownerId = service.team.primaryContact?.id;
          }
        }

        // If no service selected, use default team
        if (!teamId) {
          const defaultTeam = await tx.team.findFirst({
            where: { isDefault: true },
            include: {
              primaryContact: true
            }
          });

          if (defaultTeam) {
            teamId = defaultTeam.id;
            ownerId = defaultTeam.primaryContact?.id;
          }
        }

        // Determine organizationId for the incident (from service or team)
        let organizationId: string | undefined;
        if (service?.organizationId) organizationId = service.organizationId;
        if (!organizationId && service?.team?.organizationId) organizationId = service.team.organizationId;

        return tx.incident.create({
          data: {
            refId,
            title: dto.title,
            description: dto.description,
            severity: dto.severity ?? "HIGH",
            serviceId: dto.serviceId,
            creatorId: creatorId || dto.reporterId,
            reporterId: dto.reporterId,
            teamId,
            ownerId
          }
        });
      });

      try {
        // Determine organizationId to route Slack job to correct installation by reloading
        // the incident with its relations (service/team) so we don't rely on transaction-local variables.
        const related = await this.prisma.incident.findUnique({
          where: { refId: incident.refId },
          include: { service: { select: { organizationId: true } }, team: { select: { organizationId: true } } }
        });

        const orgId = related?.service?.organizationId ?? related?.team?.organizationId;

        await this.slackQueue?.enqueueCreateIncident({
          refId: incident.refId,
          title: incident.title,
          createdAt: incident.createdAt ? incident.createdAt.toISOString() : new Date().toISOString(),
          service: dto.serviceId,
          reporterId: incident.reporterId ?? creatorId ?? dto.reporterId ?? "",
          organizationId: orgId,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to enqueue Slack channel creation for ${incident.refId}: ${err?.message ?? err}`);
      }

      return incident;
    }

    // Fallback for test mocks or prisma clients without $transaction
    let currentMax = 0;
    if (typeof (this.prisma as any).$queryRaw === 'function') {
      const rows: Array<{ maxnum: number } & Record<string, any>> = await (this.prisma as any).$queryRaw`
        SELECT COALESCE(MAX((regexp_replace("refId", '^INC-', ''))::int), 0) as maxnum
        FROM "Incident"
        WHERE "refId" LIKE 'INC-%'
      `;
      currentMax = rows?.[0]?.maxnum ?? 0;
    } else {
      // Mock prisma in tests may not implement $queryRaw; fall back to reading existing refIds
      const all: Array<{ refId?: string }> = await this.prisma.incident.findMany({ select: { refId: true } });
      for (const r of all) {
        if (r.refId && r.refId.startsWith('INC-')) {
          const n = Number(r.refId.replace(/^INC-0*/, ''));
          if (!Number.isNaN(n) && n > currentMax) currentMax = n;
        }
      }
    }
    const next = Number(currentMax) + 1;
    const refId = `INC-${String(next).padStart(4, "0")}`;

    // Determine team and owner based on service
    let teamId: string | undefined;
    let ownerId: string | undefined;

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
        include: {
          team: {
            include: {
              primaryContact: true,
              secondaryContact: true
            }
          }
        }
      });

      if (service?.team) {
        teamId = service.team.id;
        ownerId = service.team.primaryContact?.id;
      }
    }

    // If no service selected, use default team
    if (!teamId) {
      const defaultTeam = await this.prisma.team.findFirst({
        where: { isDefault: true },
        include: {
          primaryContact: true
        }
      });

      if (defaultTeam) {
        teamId = defaultTeam.id;
        ownerId = defaultTeam.primaryContact?.id;
      }
    }

    const incident = await this.prisma.incident.create({
      data: {
        refId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? "HIGH",
        serviceId: dto.serviceId,
        creatorId: creatorId || dto.reporterId,
        reporterId: dto.reporterId,
        teamId,
        ownerId
      }
    });

    try {
      // Determine organizationId to route Slack job to correct installation
      const orgId = (await this.prisma.service.findUnique({ where: { id: dto.serviceId }, select: { organizationId: true } }))?.organizationId
        ?? (await this.prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } }))?.organizationId;

      await this.slackQueue?.enqueueCreateIncident({
        refId: incident.refId,
        title: incident.title,
        createdAt: incident.createdAt ? incident.createdAt.toISOString() : new Date().toISOString(),
        service: dto.serviceId,
        reporterId: incident.reporterId ?? creatorId ?? dto.reporterId ?? "",
        organizationId: orgId,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to enqueue Slack channel creation for ${incident.refId}: ${err?.message ?? err}`);
    }

    return incident;
  }

  async addTimelineEvent(refId: string, dto: AddEventDto) {
    const incident = await this.getIncident(refId);
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : undefined;

    return this.prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        type: dto.type,
        timestamp,
        message: dto.message,
        slackTs: dto.slackTs,
        slackUser: dto.slackUser,
        metadata: dto.metadata
      }
    });
  }

  async addSummary(refId: string, dto: AddSummaryDto) {
    const incident = await this.getIncident(refId);
    return this.prisma.incidentSummary.create({
      data: {
        incidentId: incident.id,
        content: dto.content,
        metadata: dto.metadata
      }
    });
  }

  async generateSummary(refId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { refId },
      select: { id: true, status: true }
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${refId} not found`);
    }

    const summaryContent = await this.aiService.generateIncidentSummary(incident.id);

    const summary = await this.prisma.incidentSummary.create({
      data: {
        incidentId: incident.id,
        content: summaryContent,
        metadata: {
          provider: 'gemini',
          model: 'gemini-2.0-flash-exp',
          generatedAt: new Date().toISOString(),
        }
      }
    });

    await this.prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        type: EventType.AI_SUMMARY,
        message: 'AI summary generated',
      }
    });

    return summary;
  }

  async updateSummary(refId: string, summaryId: string, content: string) {
    const incident = await this.getIncident(refId);

    const summary = await this.prisma.incidentSummary.findFirst({
      where: { id: summaryId, incidentId: incident.id }
    });

    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} not found for incident ${refId}`);
    }

    return this.prisma.incidentSummary.update({
      where: { id: summaryId },
      data: {
        content,
        metadata: {
          ...(summary.metadata as object || {}),
          manuallyEdited: true,
          editedAt: new Date().toISOString(),
        }
      }
    });
  }

  async updateStatusAndLog(refId: string, status: Status, event: AddEventDto, userId?: string) {
    // Fetch the incident with Slack channel info and user info
    const incidentBefore = await this.prisma.incident.findUnique({
      where: { refId },
      include: { createdBy: true }
    });

    if (!incidentBefore) {
      throw new NotFoundException(`Incident ${refId} not found`);
    }

    const incident = await this.prisma.incident.update({
      where: { refId },
      data: { status }
    });

    // Resolve actor name when update comes from the UI userId
    let actorName: string | undefined = undefined;
    if (userId) {
      try {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true }
        });
        actorName = u?.name || u?.email || undefined;
      } catch (_) {
        actorName = undefined;
      }
    }

    // Build metadata to include the before/after status for display
    const baseMetadata = typeof event.metadata === 'object' && event.metadata !== null
      ? { ...(event.metadata as object) }
      : {};
    const finalMetadata = {
      ...baseMetadata,
      fromStatus: incidentBefore.status,
      toStatus: status,
    };

    await this.prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        type: EventType.STATUS_CHANGE,
        timestamp: event.timestamp ? new Date(event.timestamp) : undefined,
        message: event.message,
        slackTs: event.slackTs,
        // prefer explicit slack user from event (Slack flows) otherwise use resolved actor name
        slackUser: event.slackUser ?? actorName ?? null,
        metadata: finalMetadata
      }
    });

    // If this update came from the UI (userId provided) and there's a Slack channel, notify Slack
    if (userId && incidentBefore.slackChannelId && this.slackQueue) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      });

      const userName = user?.name || user?.email || 'Unknown user';
      const statusText = event.message || `Status changed to ${status}`;

      // Queue the Slack notification
      await this.slackQueue.enqueueStatusUpdate({
        channelId: incidentBefore.slackChannelId,
        refId: incident.refId,
        status,
        statusText,
        userName
      });
    }

    return incident;
  }

  private async getIncident(refId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { refId },
      select: { id: true }
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${refId} not found`);
    }

    return incident;
  }
}

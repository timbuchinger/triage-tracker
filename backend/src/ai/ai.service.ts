import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeminiClient } from './gemini.client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly geminiClient: GeminiClient,
    private readonly prisma: PrismaService,
  ) {}

  async generateIncidentSummary(incidentId: string): Promise<string> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${incidentId} not found`);
    }

    const prompt = this.buildSummaryPrompt(incident);

    this.logger.log(`Generating summary for incident ${incident.refId}`);

    const summary = await this.geminiClient.generateText(prompt);

    return this.parseSummary(summary);
  }

  private buildSummaryPrompt(incident: any): string {
    const timelineText = incident.timeline
      .map((event: any) => {
        const timestamp = new Date(event.timestamp).toISOString();
        const type = event.type.toLowerCase().replace('_', ' ');
        const message = event.message || '';
        return `[${timestamp}] ${type}: ${message}`;
      })
      .join('\n');

    return `You are an incident management assistant. Analyze the following incident and create a concise summary.

  Incident: ${incident.title}
  Severity: ${incident.severity}
  Status: ${incident.status}
  Description: ${incident.description || 'N/A'}

  Internal Notes: ${incident.internalNotes || 'None'}

  Timeline Events:
  ${timelineText || 'No timeline events recorded.'}

  Produce a summary highlighting the most important events and identifying the root cause.

  Format your response exactly as follows:
  ----
  [Summary text here - be concise and focus on key events]

  Root cause: [root cause description or "unknown" if not identifiable]
  ----`;
  }

  private parseSummary(rawSummary: string): string {
    const cleaned = rawSummary.replace(/^-+\n?/gm, '').replace(/\n?-+$/gm, '');
    return cleaned.trim();
  }
}

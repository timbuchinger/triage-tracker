import { Injectable, Logger } from "@nestjs/common";
import { EventType, Severity, Status } from "@prisma/client";
import { IncidentsService } from "../incidents/incidents.service";
import { SlackClient } from "./slack.client";
import { SlackQueueService } from "./slack-queue.service";

type SlashCommandPayload = {
  text?: string;
  trigger_id: string;
  user_id: string;
  channel_id: string;
  channel_name?: string;
  response_url?: string;
};

type ViewState = {
  values?: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>;
};

type ViewSubmissionPayload = {
  type: string;
  user: { id: string };
  view: {
    callback_id: string;
    private_metadata?: string;
    state: ViewState;
  };
};

type InteractionPayload = {
  type: string;
  user: { id: string };
  view?: ViewSubmissionPayload["view"];
};

interface PrivateMetadata {
  channel_id?: string;
  channel_name?: string;
  response_url?: string;
  user_id?: string;
}

@Injectable()
export class SlackIncService {
  private readonly logger = new Logger(SlackIncService.name);

  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly slackClient: SlackClient,
    private readonly slackQueue: SlackQueueService
  ) {}

  async handleSlashCommand(body: SlashCommandPayload) {
    // For improved UX we show an action-selection modal on `/inc` so users
    // can choose the flow (Change status / Provide update). The previous
    // text-based shortcuts are deprecated in favor of the selector.
    const privateMetadata = JSON.stringify({
      channel_id: body.channel_id,
      channel_name: body.channel_name,
      user_id: body.user_id,
      response_url: body.response_url
    });

    // Detect if we're in an incident channel
    const incidentRef = this.deriveIncidentRefFromChannel(body.channel_name);
    const isIncidentChannel = !!incidentRef;

    try {
      await this.slackClient.openView(body.trigger_id, this.buildActionSelectorModal(privateMetadata, isIncidentChannel));
      return { text: "Opening incident actions…" };
    } catch (err: any) {
      // Slack trigger_ids expire quickly. Rather than bubbling an exception
      // which surfaces noisy error logs, provide a graceful fallback: log a
      // warning and post a message to the channel so the user can retry.
      this.logger.warn(`views.open failed: ${err?.message ?? err}`);

      // Attempt to notify the user in-channel using bot token (if available).
      try {
        if (body.channel_id) {
          await this.slackClient.postMessage({
            channel: body.channel_id,
            text: "Couldn't open the modal — please try the command again."
          });
        }
      } catch (postErr) {
        const msg = (postErr as any)?.message ?? postErr;
        this.logger.warn(`Failed to send fallback message: ${msg}`);
      }

      return { text: "Couldn't open the modal — please try again." };
    }
  }

  async handleInteraction(payloadRaw: string) {
    const payload = JSON.parse(payloadRaw) as InteractionPayload;

    if (payload.type === "view_submission" && payload.view) {
      if (payload.view.callback_id === "inc_create") {
        return this.handleCreateSubmission(payload as ViewSubmissionPayload);
      }
      if (payload.view.callback_id === "inc_status") {
        return this.handleStatusSubmission(payload as ViewSubmissionPayload);
      }
      if (payload.view.callback_id === "inc_action") {
        return this.handleActionSelection(payload as ViewSubmissionPayload);
      }
      if (payload.view.callback_id === "inc_update") {
        return this.handleUpdateSubmission(payload as ViewSubmissionPayload);
      }
    }

    return {};
  }

  private async handleActionSelection(payload: ViewSubmissionPayload) {
    // The selector modal submission can push a new view using response_action: "push"
    const values = payload.view.state;
    const selected = this.extractValue(values, "action_block");
    const metadata = this.parseMetadata(payload.view.private_metadata);
    const incidentRef = this.deriveIncidentRefFromChannel(metadata.channel_name);

    if (selected === "create_incident") {
      const next = this.buildCreateIncidentModal(payload.view.private_metadata ?? JSON.stringify(metadata));
      return { response_action: "push", view: next };
    }

    if (selected === "change_status") {
      const next = this.buildStatusUpdateModal(payload.view.private_metadata ?? JSON.stringify(metadata), incidentRef ?? "");
      return { response_action: "push", view: next };
    }

    if (selected === "provide_update") {
      const next = this.buildProvideUpdateModal(payload.view.private_metadata ?? JSON.stringify(metadata), incidentRef ?? "");
      return { response_action: "push", view: next };
    }

    // Default: no-op
    return {};
  }

  private async handleUpdateSubmission(payload: ViewSubmissionPayload) {
    const values = payload.view.state;
    const metadata = this.parseMetadata(payload.view.private_metadata);
    let refId = this.extractValue(values, "incident_ref");
    const updateText = this.extractValue(values, "update_text");

    if (!refId) {
      refId = this.deriveIncidentRefFromChannel(metadata.channel_name);
    }

    if (!refId) {
      return {
        response_action: "errors",
        errors: { incident_ref: "Incident ID is required (or use an incident channel)" }
      };
    }

    if (!updateText) {
      return { response_action: "errors", errors: { update_text: "Update text is required" } };
    }

    // Create timeline event
    const timeline = await this.incidentsService.addTimelineEvent(refId, {
      type: EventType.MESSAGE,
      message: updateText,
      slackUser: payload.user.id,
      slackTs: null
    } as any);

    // Post to channel and pin if channel available
    if (metadata.channel_id) {
      const posted = await this.slackClient.postMessage({ channel: metadata.channel_id, text: updateText });
      if (posted?.ts) {
        try {
          await this.slackClient.pinMessage(metadata.channel_id, posted.ts as string);
        } catch (err) {
          this.logger.warn(`Failed to pin message for ${refId}: ${err}`);
        }
      }
    }

    return {};
  }

  private async handleCreateSubmission(payload: ViewSubmissionPayload) {
    const values = payload.view.state;
    const title = this.extractValue(values, "title");
    const severity = this.extractValue(values, "severity") as Severity | undefined;
    const description = this.extractValue(values, "description");
    const service = this.extractValue(values, "service");

    if (!title) {
      return { response_action: "errors", errors: { title: "Title is required" } };
    }

    const metadata = this.parseMetadata(payload.view.private_metadata);
    const incident = await this.incidentsService.create({
      title,
      description: description || undefined,
      severity: severity ?? "HIGH"
    });

    await this.slackQueue.enqueueCreateIncident({
      refId: incident.refId,
      title: incident.title,
      createdAt: incident.createdAt.toISOString(),
      service,
      reporterId: metadata.user_id ?? payload.user.id
    });

    if (metadata.response_url) {
      await this.slackClient.postMessage({
        channel: metadata.channel_id ?? payload.user.id,
        text: `Created ${incident.refId}. Slack channel creation queued.`
      });
    }

    return {};
  }

  private async handleStatusSubmission(payload: ViewSubmissionPayload) {
    const values = payload.view.state;
    const metadata = this.parseMetadata(payload.view.private_metadata);
    let refId = this.extractValue(values, "incident_ref");
    const status = this.extractValue(values, "status") as Status | undefined;
    const statusText = this.extractValue(values, "status_text");

    if (!refId) {
      refId = this.deriveIncidentRefFromChannel(metadata.channel_name);
    }

    if (!refId) {
      return {
        response_action: "errors",
        errors: { incident_ref: "Incident ID is required (or use an incident channel)" }
      };
    }

    if (!status) {
      return { response_action: "errors", errors: { status: "Status is required" } };
    }

    if (!statusText) {
      return { response_action: "errors", errors: { status_text: "Update text is required" } };
    }

    const incident = await this.incidentsService.updateStatusAndLog(refId, status, {
      type: EventType.STATUS_CHANGE,
      message: statusText,
      slackUser: payload.user.id,
      metadata: {
        slackChannelId: metadata.channel_id,
        status
      }
    });

    if (metadata.channel_id) {
      await this.slackQueue.enqueueStatusUpdate({
        channelId: metadata.channel_id,
        refId: incident.refId,
        status,
        statusText
      });
    }

    return {};
  }

  private extractValue(state: ViewState, blockId: string) {
    const block = state.values?.[blockId];
    if (!block) {
      return undefined;
    }
    const action = Object.values(block)[0];
    return action?.value ?? action?.selected_option?.value;
  }

  private parseMetadata(meta?: string): PrivateMetadata {
    if (!meta) {
      return {};
    }
    try {
      return JSON.parse(meta) as PrivateMetadata;
    } catch (error) {
      this.logger.warn(`Invalid Slack private_metadata: ${error}`);
      return {};
    }
  }

  private deriveIncidentRefFromChannel(channelName?: string) {
    if (!channelName) {
      return undefined;
    }
    const match = channelName.match(/^([A-Za-z0-9-]+)-\d{4}-\d{2}-\d{2}$/);
    return match ? match[1].toUpperCase() : undefined;
  }

  private buildCreateIncidentModal(privateMetadata: string) {
    return {
      type: "modal",
      callback_id: "inc_create",
      title: { type: "plain_text", text: "New Incident" },
      submit: { type: "plain_text", text: "Create" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: privateMetadata,
      blocks: [
        {
          type: "input",
          block_id: "title",
          label: { type: "plain_text", text: "Title" },
          element: { type: "plain_text_input", action_id: "value" }
        },
        {
          type: "input",
          optional: true,
          block_id: "description",
          label: { type: "plain_text", text: "Description" },
          element: { type: "plain_text_input", action_id: "value", multiline: true }
        },
        {
          type: "input",
          block_id: "severity",
          label: { type: "plain_text", text: "Severity" },
          element: {
            type: "static_select",
            action_id: "value",
            initial_option: { text: { type: "plain_text", text: "HIGH" }, value: "HIGH" },
            options: [
              { text: { type: "plain_text", text: "CRITICAL" }, value: "CRITICAL" },
              { text: { type: "plain_text", text: "HIGH" }, value: "HIGH" },
              { text: { type: "plain_text", text: "MEDIUM" }, value: "MEDIUM" },
              { text: { type: "plain_text", text: "LOW" }, value: "LOW" }
            ]
          }
        },
        {
          type: "input",
          optional: true,
          block_id: "service",
          label: { type: "plain_text", text: "Service / Component" },
          element: { type: "plain_text_input", action_id: "value" }
        }
      ]
    };
  }

  private buildActionSelectorModal(privateMetadata: string, isIncidentChannel: boolean) {
    // In incident channels, offer status change and updates
    // Outside incident channels, only offer to create a new incident
    const options = isIncidentChannel
      ? [
          { text: { type: "plain_text", text: "Change status" }, value: "change_status" },
          { text: { type: "plain_text", text: "Provide update" }, value: "provide_update" }
        ]
      : [
          { text: { type: "plain_text", text: "Create incident" }, value: "create_incident" }
        ];

    return {
      type: "modal",
      callback_id: "inc_action",
      title: { type: "plain_text", text: "Incident Actions" },
      submit: { type: "plain_text", text: "Continue" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: privateMetadata,
      blocks: [
        {
          type: "input",
          block_id: "action_block",
          label: { type: "plain_text", text: "Select an action" },
          element: {
            type: "static_select",
            action_id: "action_select",
            options
          }
        }
      ]
    };
  }

  private buildProvideUpdateModal(privateMetadata: string, refId: string) {
    // When in an incident channel (refId is set), hide the incident ID field
    const blocks: any[] = [];

    if (!refId) {
      blocks.push({
        type: "input",
        block_id: "incident_ref",
        label: { type: "plain_text", text: "Incident ID" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "INC-1234" }
        }
      });
    } else {
      // Show incident ID as context but don't allow editing
      blocks.push({
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Incident:* ${refId}` }
        ]
      });
    }

    blocks.push({
      type: "input",
      block_id: "update_text",
      label: { type: "plain_text", text: "Update" },
      element: { type: "plain_text_input", action_id: "value", multiline: true }
    });

    return {
      type: "modal",
      callback_id: "inc_update",
      title: { type: "plain_text", text: "Provide Update" },
      submit: { type: "plain_text", text: "Post" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: privateMetadata,
      blocks
    };
  }

  private buildStatusUpdateModal(privateMetadata: string, refId: string) {
    // When in an incident channel (refId is set), hide the incident ID field
    const blocks: any[] = [];

    if (!refId) {
      blocks.push({
        type: "input",
        block_id: "incident_ref",
        label: { type: "plain_text", text: "Incident ID" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "INC-1234" }
        }
      });
    } else {
      // Show incident ID as context but don't allow editing
      blocks.push({
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Incident:* ${refId}` }
        ]
      });
    }

    blocks.push(
      {
        type: "input",
        block_id: "status",
        label: { type: "plain_text", text: "Status" },
        element: {
          type: "static_select",
          action_id: "value",
          options: [
            { text: { type: "plain_text", text: "Open" }, value: "OPEN" },
            { text: { type: "plain_text", text: "Investigating" }, value: "INVESTIGATING" },
            { text: { type: "plain_text", text: "Mitigated" }, value: "MITIGATED" },
            { text: { type: "plain_text", text: "Resolved" }, value: "RESOLVED" }
          ]
        }
      },
      {
        type: "input",
        block_id: "status_text",
        label: { type: "plain_text", text: "What changed?" },
        element: { type: "plain_text_input", action_id: "value", multiline: true }
      }
    );

    return {
      type: "modal",
      callback_id: "inc_status",
      title: { type: "plain_text", text: "Incident Update" },
      submit: { type: "plain_text", text: "Post update" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: privateMetadata,
      blocks
    };
  }

  async handleEvent(payload: any) {
    const { event } = payload;

    if (event.type === 'reaction_added' &&
        (event.reaction === '+1' || event.reaction === 'thumbsup')) {

      await this.slackQueue.queueReactionEvent({
        channelId: event.item.channel,
        messageTs: event.item.ts,
        userId: event.user,
        reaction: event.reaction,
        eventTs: event.event_ts,
      });
    }

    return { ok: true };
  }
}

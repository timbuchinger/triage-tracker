import { EventType, Incident, Status } from "@prisma/client";
import { SlackIncService } from "./slack-inc.service";

const createMockIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "inc_1",
  refId: "INC-1234",
  title: "Test incident",
  description: null,
  severity: "HIGH",
  status: "OPEN",
  serviceId: null,
  slackChannelId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  // Ensure we satisfy the Incident type shape for tests — cast is safe here for mocks
  ...overrides
} as unknown as Incident);

describe("SlackIncService", () => {
  const incidentsService = {
    create: jest.fn(),
    addTimelineEvent: jest.fn(),
    updateStatusAndLog: jest.fn(),
    findOne: jest.fn()
  };

  const slackClient = {
    openView: jest.fn(),
    postMessage: jest.fn(),
    pinMessage: jest.fn()
  };

  const slackQueue = {
    enqueueCreateIncident: jest.fn(),
    enqueueStatusUpdate: jest.fn(),
    queueReactionEvent: jest.fn()
  };

  const service = new SlackIncService(
    incidentsService as any,
    slackClient as any,
    slackQueue as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    incidentsService.findOne.mockResolvedValue(createMockIncident());
  });

  it("routes /inc with no text to the create modal", async () => {
    const res = await service.handleSlashCommand({
      text: "",
      trigger_id: "trigger",
      user_id: "U123",
      channel_id: "C1"
    });

    expect(slackClient.openView).toHaveBeenCalledWith(
      "trigger",
      expect.objectContaining({ callback_id: "inc_action" })
    );
    expect(res.text).toMatch(/Opening incident actions/);
  });

  it("routes /inc status to the status modal", async () => {
    await service.handleSlashCommand({
      text: "status inc-9",
      trigger_id: "trigger",
      user_id: "U123",
      channel_id: "C1"
    });
    expect(slackClient.openView).toHaveBeenCalledWith(
      "trigger",
      expect.objectContaining({ callback_id: "inc_action" })
    );
  });

  it("returns usage on unknown subcommand", async () => {
    const result = await service.handleSlashCommand({
      text: "help",
      trigger_id: "t",
      user_id: "U1",
      channel_id: "C1"
    });
    // The new UX opens an action selector for all `/inc` invocations.
    expect(result.text).toMatch(/Opening incident actions/);
    expect(slackClient.openView).toHaveBeenCalled();
  });

  it("handles create modal submission and records timeline", async () => {
    const incident = createMockIncident();
    incidentsService.create.mockResolvedValue(incident);
    slackQueue.enqueueCreateIncident.mockResolvedValue({});

    const payload = {
      type: "view_submission",
      user: { id: "U123" },
      view: {
        callback_id: "inc_create",
        private_metadata: JSON.stringify({ channel_id: "C1" }),
        state: {
          values: {
            title: { value: { value: "New incident" } },
            description: { value: { value: "Desc" } },
            severity: { value: { selected_option: { value: "CRITICAL" } } },
            service: { value: { value: "api-gateway" } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({});
    expect(slackQueue.enqueueCreateIncident).toHaveBeenCalledWith({
      refId: incident.refId,
      title: incident.title,
      createdAt: incident.createdAt.toISOString(),
      service: "api-gateway",
      reporterId: "U123"
    });
  });

  it("rejects create submission without title", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U123" },
      view: {
        callback_id: "inc_create",
        state: { values: { title: { value: { value: "" } } } }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));
    expect(result).toEqual({
      response_action: "errors",
      errors: { title: "Title is required" }
    });
    expect(incidentsService.create).not.toHaveBeenCalled();
  });

  it("updates status and posts to Slack on status submission", async () => {
    incidentsService.updateStatusAndLog.mockResolvedValue(createMockIncident({ status: "RESOLVED" }));
    const payload = {
      type: "view_submission",
      user: { id: "U321" },
      view: {
        callback_id: "inc_status",
        private_metadata: JSON.stringify({ channel_id: "C_INC" }),
        state: {
          values: {
            incident_ref: { value: { value: "INC-1234" } },
            status: { value: { selected_option: { value: "RESOLVED" } } },
            status_text: { value: { value: "Fixed" } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({});
    expect(incidentsService.updateStatusAndLog).toHaveBeenCalledWith("INC-1234", "RESOLVED", {
      type: EventType.STATUS_CHANGE,
      message: "Fixed",
      slackUser: "U321",
      metadata: expect.objectContaining({ status: "RESOLVED", slackChannelId: "C_INC" })
    });
    expect(slackQueue.enqueueStatusUpdate).toHaveBeenCalledWith({
      channelId: "C_INC",
      refId: "INC-1234",
      status: "RESOLVED",
      statusText: "Fixed"
    });
  });

  it("derives incident ref from channel name when missing", async () => {
    incidentsService.updateStatusAndLog.mockResolvedValue(createMockIncident({ status: "OPEN" }));
    const payload = {
      type: "view_submission",
      user: { id: "U321" },
      view: {
        callback_id: "inc_status",
        private_metadata: JSON.stringify({ channel_id: "C_INC", channel_name: "inc-9999-2024-01-01" }),
        state: {
          values: {
            incident_ref: { value: { value: "" } },
            status: { value: { selected_option: { value: "OPEN" } } },
            status_text: { value: { value: "Monitoring" } }
          }
        }
      }
    };

    await service.handleInteraction(JSON.stringify(payload));

    expect(incidentsService.updateStatusAndLog).toHaveBeenCalledWith("INC-9999", "OPEN", expect.anything());
  });

  it("rejects status submission missing update text", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U321" },
      view: {
        callback_id: "inc_status",
        state: {
          values: {
            incident_ref: { value: { value: "INC-1234" } },
            status: { value: { selected_option: { value: "RESOLVED" } } },
            status_text: { value: { value: "" } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));
    expect(result).toEqual({
      response_action: "errors",
      errors: { status_text: "Update text is required" }
    });
    expect(incidentsService.updateStatusAndLog).not.toHaveBeenCalled();
  });

  it("errors when no incident ref or channel mapping", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U111" },
      view: {
        callback_id: "inc_status",
        private_metadata: JSON.stringify({}),
        state: {
          values: {
            incident_ref: { value: { value: "" } },
            status: { value: { selected_option: { value: "OPEN" } } },
            status_text: { value: { value: "Checking" } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({
      response_action: "errors",
      errors: { incident_ref: "Incident ID is required (or use an incident channel)" }
    });
    expect(incidentsService.updateStatusAndLog).not.toHaveBeenCalled();
  });

  it("shows only create incident option when outside incident channel", async () => {
    await service.handleSlashCommand({
      text: "",
      trigger_id: "trigger",
      user_id: "U123",
      channel_id: "C1",
      channel_name: "general"
    });

    expect(slackClient.openView).toHaveBeenCalledWith(
      "trigger",
      expect.objectContaining({
        callback_id: "inc_action",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            element: expect.objectContaining({
              options: [
                { text: { type: "plain_text", text: "Create incident" }, value: "create_incident" }
              ]
            })
          })
        ])
      })
    );
  });

  it("shows status and update options when inside incident channel", async () => {
    await service.handleSlashCommand({
      text: "",
      trigger_id: "trigger",
      user_id: "U123",
      channel_id: "C1",
      channel_name: "inc-1234-2025-12-01"
    });

    expect(slackClient.openView).toHaveBeenCalledWith(
      "trigger",
      expect.objectContaining({
        callback_id: "inc_action",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            element: expect.objectContaining({
              options: [
                { text: { type: "plain_text", text: "Change status" }, value: "change_status" },
                { text: { type: "plain_text", text: "Provide update" }, value: "provide_update" }
              ]
            })
          })
        ])
      })
    );
  });

  it("handles create_incident action selection", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U123" },
      view: {
        callback_id: "inc_action",
        private_metadata: JSON.stringify({ channel_id: "C1", channel_name: "general" }),
        state: {
          values: {
            action_block: { action_select: { selected_option: { value: "create_incident" } } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({
      response_action: "update",
      view: expect.objectContaining({ callback_id: "inc_create" })
    });
  });

  it("hides incident ID field in status modal when in incident channel", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U123" },
      view: {
        callback_id: "inc_action",
        private_metadata: JSON.stringify({ channel_id: "C1", channel_name: "inc-5678-2025-12-01" }),
        state: {
          values: {
            action_block: { action_select: { selected_option: { value: "change_status" } } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({
      response_action: "update",
      view: expect.objectContaining({
        callback_id: "inc_status",
        blocks: expect.arrayContaining([
          // Should have context block showing incident ID, not an input field
          expect.objectContaining({
            type: "context",
            elements: expect.arrayContaining([
              expect.objectContaining({ text: "*Incident:* INC-5678" })
            ])
          })
        ])
      })
    });

    // Should NOT have an incident_ref input block
    const statusModal = (result as any).view;
    const hasIncidentRefInput = statusModal.blocks.some(
      (block: any) => block.block_id === "incident_ref" && block.type === "input"
    );
    expect(hasIncidentRefInput).toBe(false);
  });

  it("hides incident ID field in update modal when in incident channel", async () => {
    const payload = {
      type: "view_submission",
      user: { id: "U123" },
      view: {
        callback_id: "inc_action",
        private_metadata: JSON.stringify({ channel_id: "C1", channel_name: "inc-5678-2025-12-01" }),
        state: {
          values: {
            action_block: { action_select: { selected_option: { value: "provide_update" } } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({
      response_action: "update",
      view: expect.objectContaining({
        callback_id: "inc_update",
        blocks: expect.arrayContaining([
          // Should have context block showing incident ID, not an input field
          expect.objectContaining({
            type: "context",
            elements: expect.arrayContaining([
              expect.objectContaining({ text: "*Incident:* INC-5678" })
            ])
          })
        ])
      })
    });

    // Should NOT have an incident_ref input block
    const updateModal = (result as any).view;
    const hasIncidentRefInput = updateModal.blocks.some(
      (block: any) => block.block_id === "incident_ref" && block.type === "input"
    );
    expect(hasIncidentRefInput).toBe(false);
  });

  it("excludes the incident's current status from the status modal options", async () => {
    // Ensure the mocked incident has status OPEN
    incidentsService.findOne.mockResolvedValue(createMockIncident({ status: "OPEN" }));

    const payload = {
      type: "view_submission",
      user: { id: "U999" },
      view: {
        callback_id: "inc_action",
        private_metadata: JSON.stringify({ channel_id: "C1", channel_name: "inc-1234-2025-12-01" }),
        state: {
          values: {
            action_block: { action_select: { selected_option: { value: "change_status" } } }
          }
        }
      }
    };

    const result = await service.handleInteraction(JSON.stringify(payload));

    expect(result).toEqual({ response_action: "push", view: expect.any(Object) });

    const statusModal = (result as any).view;
    const statusBlock = statusModal.blocks.find((b: any) => b.block_id === "status");
    expect(statusBlock).toBeDefined();
    const options = statusBlock.element.options as Array<{ value: string }>;

    // The current status (OPEN) should NOT be present
    const hasCurrent = options.some((o) => o.value === "OPEN");
    expect(hasCurrent).toBe(false);

    // Other statuses should still be available
    const expected = ["INVESTIGATING", "MITIGATED", "RESOLVED"];
    for (const v of expected) {
      expect(options.some((o) => o.value === v)).toBe(true);
    }
  });
});

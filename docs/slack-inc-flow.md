# Slack `/inc` Slash Command Blueprint

Planning notes for implementing the Slack `/inc` command without touching runtime code yet. Covers payloads, modal layouts, config, endpoints, and the test matrix to drive a TDD pass.

## Slack configuration
- `SLACK_SIGNING_SECRET` — used by the API to validate `X-Slack-Signature`/`X-Slack-Request-Timestamp` on `/api/integrations/slack/*` requests.
- `SLACK_BOT_TOKEN` — bot token with scopes `commands`, `chat:write`, `chat:write.public`, `channels:manage`, `channels:join`, `groups:write`, `im:write`, `mpim:write`. Used by the API (to open modals and post messages) and by the worker (to post follow-up messages).
- `SLACK_APP_TOKEN` (optional) — only needed if we add Socket Mode; not required for HTTPS-based slash commands.
- Store secrets in `backend/.env` (and mirror into the worker runtime). Loaded via `dotenv/config` in `backend/src/main.ts`; expose via a SlackModule config provider rather than reading `process.env` in services.
- `REDIS_URL` — BullMQ connection string (default `redis://localhost:6379`) powering the Slack job queue.

## Ingress endpoints (planned)
- `POST /api/integrations/slack/commands/inc` — handles the slash command (`application/x-www-form-urlencoded`). Responsibilities: signature verification, parsing `text`, routing to the correct modal via `views.open`, and immediate `200` with an ephemeral usage hint on errors.
- `POST /api/integrations/slack/interactions` — handles `view_submission`/`block_actions` payloads (JSON in the `payload` form field). Responsibilities: signature verification, branching on `view.callback_id`, validation, and invoking domain services.
- Downstream domain calls should reuse existing modules:
  - Create: `POST /api/incidents` (maps to `IncidentsService.create`).
  - Status update: extend `IncidentsService` with an atomic `updateStatusAndLog` helper that updates `Incident.status` and appends a `STATUS_CHANGE` timeline event via `POST /api/incidents/:refId/events` internally (no direct Prisma access from Slack handlers).

## Slash command payload & branching
Incoming `POST /api/integrations/slack/commands/inc` fields of interest: `command`, `text`, `trigger_id`, `user_id`, `team_id`, `channel_id`, `response_url`, `enterprise_id`. Branching:
- Empty text or `new`: open the **Create Incident** modal.
- `status <INC-1234>` (or `update <INC-1234>`): open the **Incident Status Update** modal prefilled with the ref ID.
- Anything else: respond `200` with ephemeral usage text (`/inc [new|status INC-1234]`) and do not open a modal.
- Include `channel_id`, `user_id`, and `response_url` in `private_metadata` so submissions can post confirmations back to the right place.

## Modal layouts (Block Kit examples)

### Create Incident modal (`callback_id: inc_create`)
```json
{
  "type": "modal",
  "callback_id": "inc_create",
  "title": { "type": "plain_text", "text": "New Incident" },
  "submit": { "type": "plain_text", "text": "Create" },
  "close": { "type": "plain_text", "text": "Cancel" },
  "private_metadata": "{\"channel_id\":\"C123\",\"user_id\":\"U123\",\"response_url\":\"https://hooks.slack.com/...\"}",
  "blocks": [
    {
      "type": "input",
      "block_id": "title",
      "label": { "type": "plain_text", "text": "Title" },
      "element": { "type": "plain_text_input", "action_id": "value" }
    },
    {
      "type": "input",
      "optional": true,
      "block_id": "description",
      "label": { "type": "plain_text", "text": "Description" },
      "element": { "type": "plain_text_input", "action_id": "value", "multiline": true }
    },
    {
      "type": "input",
      "block_id": "severity",
      "label": { "type": "plain_text", "text": "Severity" },
      "element": {
        "type": "static_select",
        "action_id": "value",
        "initial_option": { "text": { "type": "plain_text", "text": "HIGH" }, "value": "HIGH" },
        "options": [
          { "text": { "type": "plain_text", "text": "CRITICAL" }, "value": "CRITICAL" },
          { "text": { "type": "plain_text", "text": "HIGH" }, "value": "HIGH" },
          { "text": { "type": "plain_text", "text": "MEDIUM" }, "value": "MEDIUM" },
          { "text": { "type": "plain_text", "text": "LOW" }, "value": "LOW" }
        ]
      }
    },
    {
      "type": "input",
      "optional": true,
      "block_id": "service",
      "label": { "type": "plain_text", "text": "Service / Component" },
      "element": { "type": "plain_text_input", "action_id": "value" }
    }
  ]
}
```

### Incident Status Update modal (`callback_id: inc_status`)
```json
{
  "type": "modal",
  "callback_id": "inc_status",
  "title": { "type": "plain_text", "text": "Incident Update" },
  "submit": { "type": "plain_text", "text": "Post update" },
  "close": { "type": "plain_text", "text": "Cancel" },
  "private_metadata": "{\"channel_id\":\"C123\",\"user_id\":\"U123\",\"response_url\":\"https://hooks.slack.com/...\"}",
  "blocks": [
    {
      "type": "input",
      "block_id": "incident_ref",
      "label": { "type": "plain_text", "text": "Incident ID" },
      "element": {
        "type": "plain_text_input",
        "action_id": "value",
        "placeholder": { "type": "plain_text", "text": "INC-1234" },
        "initial_value": "INC-1234"
      }
    },
    {
      "type": "input",
      "block_id": "status",
      "label": { "type": "plain_text", "text": "Status" },
      "element": {
        "type": "static_select",
        "action_id": "value",
        "options": [
          { "text": { "type": "plain_text", "text": "Open" }, "value": "OPEN" },
          { "text": { "type": "plain_text", "text": "Investigating" }, "value": "INVESTIGATING" },
          { "text": { "type": "plain_text", "text": "Mitigated" }, "value": "MITIGATED" },
          { "text": { "type": "plain_text", "text": "Resolved" }, "value": "RESOLVED" }
        ]
      }
    },
    {
      "type": "input",
      "block_id": "status_text",
      "label": { "type": "plain_text", "text": "What changed?" },
      "element": { "type": "plain_text_input", "action_id": "value", "multiline": true }
    }
  ]
}
```

## Submission handling & side effects

### Create Incident
1. Validate required fields (`title`, `severity`) and map severity to the Prisma `Severity` enum.
2. Call `IncidentsService.create` (existing) with `title`, `description`, `severity`. Capture returned `refId` and `createdAt`.
3. Enqueue a BullMQ job `create-incident-channel` with `{refId, title, createdAt, service, reporterId}`. Worker creates Slack channel `[refId]-[YYYY-MM-DD]`, invites reporter, sets topic, posts summary, and records timeline event with Slack metadata.
4. Acknowledge the original `response_url` with the incident ref and queued channel creation note (ephemeral).

### Incident Status Update
1. Validate `incident_ref` exists (fallback to deriving from incident channel name); if not, respond with `response_action: "errors"` or an ephemeral message.
2. Update the `Incident.status` to the selected value via `IncidentsService.updateStatusAndLog` (atomic DB update + timeline event).
3. Enqueue `post-status-update` BullMQ job with `{channelId, refId, status, statusText}` to post the bot message in the incident channel.
4. Acknowledge the modal submission with a short confirmation.

### Error handling
- Reject replayed or invalid signatures with `401` before parsing bodies.
- On modal validation failures, return `response_action: "errors"` with per-field errors; avoid partial writes.
- On Slack API failures (e.g., channel creation), surface an ephemeral error and do not create DB records.

## TDD test matrix (initial failing tests to add)
| Test name | Purpose | Layer |
| --- | --- | --- |
| `rejects_invalid_slack_signature` | Ensure signature guard rejects tampered requests | Unit (guard) |
| `accepts_valid_signature_with_tolerance` | Accepts valid signature within timestamp skew | Unit (guard) |
| `inc_command_routes_to_create_modal` | `/inc` with empty text opens create modal and returns 200 | Unit (controller + mocked Slack client) |
| `inc_command_routes_to_status_modal` | `/inc status INC-1234` opens status modal with ref prefilled | Unit |
| `inc_command_usage_error_on_unknown_text` | Unknown subcommand returns usage text, no modal | Unit |
| `create_modal_validation_error_on_missing_title` | Missing title returns `response_action: errors` and no DB writes | Integration (controller + service) |
| `create_modal_creates_incident_and_channel` | Submitting valid create modal creates DB incident, channel, posts bot message | Integration (controller with mocked Slack client + Prisma test DB) |
| `create_modal_records_timeline_metadata` | Timeline event captures Slack channel ID/TS in `metadata` | Integration |
| `status_modal_rejects_unknown_incident` | View submission with unknown ref returns error, no Slack post | Integration |
| `status_modal_updates_status_and_timeline` | Valid status update sets `Incident.status` and adds `STATUS_CHANGE` event | Integration |
| `status_modal_posts_slack_message` | Status update triggers `chat.postMessage` to incident channel | Integration |
| `status_modal_requires_status_text` | Empty status text returns validation error | Unit |

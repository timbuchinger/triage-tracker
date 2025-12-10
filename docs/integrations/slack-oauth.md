# Slack Workspace Integration Guide

## Overview

The Slack workspace integration allows organizations to connect their Slack workspace to Triage Tracker, enabling:

- Incident notifications in Slack channels
- Slash commands for creating incidents
- Interactive status updates and workflows
- Thumbs-up reaction tracking in timelines
- Two-way synchronization between Slack and Triage Tracker

## Architecture

### OAuth 2.0 Flow

The integration uses Slack's OAuth v2 flow for secure workspace linking:

1. **User initiates**: Admin clicks "Connect Workspace" in Settings → Integrations
2. **State token created**: Backend generates a cryptographic state token (10-minute TTL)
3. **Redirect to Slack**: User is redirected to Slack's authorization page
4. **User authorizes**: User reviews and approves requested permissions
5. **Callback handled**: Slack redirects back with authorization code
6. **Token exchange**: Backend exchanges code for bot token (stored encrypted)
7. **Integration active**: Workspace is now linked and ready for use

### Database Schema

```prisma
model Organization {
  id                String              @id @default(cuid())
  name              String
  slackIntegrations SlackIntegration[]
}

model SlackIntegration {
  id                String       @id @default(cuid())
  organizationId    String       @unique
  teamId            String
  teamName          String
  botToken          String       // Encrypted
  userToken         String?      // Encrypted (optional)
  scopes            String       // Comma-separated
  installedByUserId String
  installedAt       DateTime
  active            Boolean
  metadata          Json?
  lastEventAt       DateTime?
}

model OAuthState {
  id             String   @id @default(cuid())
  state          String   @unique
  organizationId String
  userId         String
  expiresAt      DateTime
}
```

## Setup Instructions

### 1. Create Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: "Triage Tracker"
4. Select your development workspace
5. Click "Create App"

### 2. Configure OAuth & Permissions

#### OAuth Redirect URLs
Add the following redirect URL (OAuth callback used by the install flow):
```
https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/callback
http://localhost:3000/api/integrations/slack/callback  # For local dev
```

#### Bot Token Scopes (recommended)
Required and recommended bot scopes for full functionality (add these in the Slack app OAuth & Permissions page):
- `commands` — allow slash commands and opening modals
- `chat:write` — post messages as the bot
- `chat:write.public` — post to public channels the bot hasn't joined
- `conversations.history` / `channels:history` & `groups:history` — read messages (used to fetch message content after reactions)
- `reactions:read` — read reactions (useful for verifying reaction events)
- `conversations:write` (or `channels:manage`) — create and manage channels (covers create, invite, set topic, and join)
- `users:read` — read user info for mentions and display

Note: individual method names like `conversations.invite` or `conversations.setTopic` are API methods, not OAuth scopes. Use `conversations:write` to grant the bot channel management capabilities.

Note: pick the history/read scopes (`conversations.history` vs `channels:history`/`groups:history`) that match your workspace needs. For private channels ensure the bot is invited or has the right scopes.

### 3. Enable Events API (runtime)

Slack needs a single runtime endpoint for events. This repo exposes two kinds of endpoints:

- OAuth install flow (callback): `GET /api/integrations/slack/callback` (keep this in OAuth settings)
- Runtime endpoints (slash commands, interactions, events) — recommended to point Slack runtime webhooks here:

  - Events Request URL: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/events`
  - Interactivity Request URL: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/interactions`

Set these values under **Event Subscriptions** and **Interactivity & Shortcuts** respectively. The runtime `/api/integrations/slack/*` endpoints are used by the app to receive slash commands, interactive payloads and events.

#### Subscribe to Bot Events
- `app_uninstalled` — detect when app is removed and mark the integration inactive
- `reaction_added` — track thumbs-up and enqueue worker job to capture message content

Optional events:
- `reaction_removed` — track un-highlights if you want to remove timeline entries
- `channel_created` / `team_channel_created` — if you need to react to channels created externally

### 4. Enable Slash Commands

#### Command: `/inc`
- Request URL: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/commands/inc`
- Short Description: "Create or manage incidents"
- Usage Hint: "[create|status|resolve]"

#### Command: `/incident`
-- Request URL: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/commands/inc`
- Short Description: "Incident management"

### 5. Enable Interactive Components

-- Request URL: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/interactions`

### 6. Configure Environment Variables

Add to `backend/.env`:

```bash
# Slack OAuth Credentials
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_REDIRECT_URI=https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/callback

# Legacy Bot Token (for existing features)
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

**⚠️ Security Note**: Never commit secrets to version control. Use environment variables or a secrets manager.

## API Endpoints

### Start OAuth Flow
```
GET /api/integrations/slack/start?organizationId={orgId}&userId={userId}
```
Generates state token and redirects to Slack authorization page.

### OAuth Callback
```
GET /api/integrations/slack/callback?code={code}&state={state}
```
Handles Slack OAuth callback, exchanges code for tokens, stores integration.

### Get Integration Status
```
GET /api/integrations/slack/{organizationId}/status
```
Returns current integration status including team name, scopes, and installer info.

**Response:**
```json
{
  "integration": {
    "teamId": "T1234567890",
    "teamName": "Acme Corp",
    "scopes": ["chat:write", "channels:read", ...],
    "installedBy": {
      "id": "user_123",
      "email": "admin@example.com",
      "name": "Jane Doe"
    },
    "installedAt": "2025-12-06T03:00:00.000Z",
    "active": true
  }
}
```

### Unlink Integration
```
DELETE /api/integrations/slack/{organizationId}
```
Deactivates the Slack integration for the organization.

## Security Features

### State Token Protection (CSRF)
- Cryptographically secure random tokens (32 bytes)
- Server-side storage with 10-minute expiration
- Single-use tokens (deleted after validation)
- Bound to specific organization and user

### Token Encryption
- Bot tokens stored encrypted in database
- Never logged or exposed in API responses
- Encrypted at rest using application-level encryption

### Signature Verification
- All webhook requests verified using Slack signing secret
- Requests with invalid signatures are rejected
- Protects against replay attacks

### Access Control
- Only organization admins can install/uninstall
- User ID tracked for audit purposes
- Integration scoped to single organization

## Event Handling

### App Uninstalled
When a user removes the app from Slack:
1. Slack sends `app_uninstalled` event
2. Backend marks integration as `active: false`
3. No further events processed for that team
4. Tokens remain stored for potential reinstall

### Reaction Added
When user adds 👍 to a message:
1. Slack sends `reaction_added` event
2. Backend queues event to worker
3. Worker fetches message content
4. Creates `HIGHLIGHTED_MESSAGE` timeline event
5. Message appears in incident timeline

## Frontend Integration

### Settings Page
Navigate to: `/settings/integrations`

**Features:**
- View connection status
- Connect/disconnect workspace
- Display installed scopes
- Show installer and installation date
- Modal with permission details

**Demo Mode:**
Uses hardcoded org/user IDs for demonstration:
```typescript
const DEMO_ORG_ID = 'org_demo_123';
const DEMO_USER_ID = 'user_demo_456';
```

**Production Mode:**
Replace with actual authentication context:
```typescript
const { organizationId, userId } = useAuth();
```

## Monitoring & Logging

### Metrics to Track
- `slack.oauth.success` - Successful OAuth completions
- `slack.oauth.fail` - Failed OAuth attempts
- `slack.events.invalid_signature` - Invalid webhook signatures
- `slack.events.processed` - Successfully processed events

### Log Events
- OAuth flow initiation and completion
- Token exchange success/failure
- Integration install/uninstall
- Event processing errors

### Alerts
- Spike in invalid signature events (possible attack)
- Repeated OAuth failures
- Token refresh failures

## Testing

### Manual Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Integration status shows correct workspace
- [ ] Scopes are displayed accurately
- [ ] Disconnect removes integration
- [ ] Reconnect updates existing integration
- [ ] `app_uninstalled` event deactivates integration
- [ ] Invalid state token is rejected
- [ ] Expired state token is rejected
- [ ] Invalid signatures are rejected

### Unit Tests
```bash
cd backend
npm test src/slack/slack-oauth.service.spec.ts
```

### Integration Tests
```bash
# Test with mock Slack API
npm run test:integration
```

## Troubleshooting

### OAuth Flow Fails
- **Check redirect URI**: Must match exactly in Slack app settings
- **Verify credentials**: SLACK_CLIENT_ID and SLACK_CLIENT_SECRET correct
- **Check state expiration**: State tokens expire after 10 minutes

### Events Not Received
- **Verify request URL**: Slack can reach your server
- **Check signing secret**: Must match Slack app configuration
- **Enable events**: Event subscriptions turned on in Slack app

### Integration Not Showing
- **Check organization ID**: Ensure using correct org context
- **Verify active flag**: Integration may be deactivated
- **Check database**: Query `SlackIntegration` table directly

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid or expired OAuth state` | State token expired or invalid | Restart OAuth flow |
| `Failed to exchange code for token` | Invalid client credentials | Check SLACK_CLIENT_ID/SECRET |
| `Invalid signature` | Wrong signing secret | Verify SLACK_SIGNING_SECRET |
| `No active Slack integration found` | Integration not installed | Install via Settings page |

## Best Practices

### For Developers
1. Never log tokens or secrets
2. Use environment variables for all credentials
3. Implement proper error handling for API failures
4. Add rate limiting for OAuth endpoints
5. Monitor for suspicious activity

### For Users
1. Only install from trusted sources
2. Review requested permissions carefully
3. Limit to organization admins only
4. Audit integration usage regularly
5. Disconnect unused integrations

## Compliance

### Data Retention
- OAuth state tokens: Deleted after use or expiration
- Integration tokens: Stored encrypted indefinitely
- Event payloads: Processed and discarded (not persisted)

### GDPR Considerations
- User email stored for installer attribution
- Soft delete integrations (mark inactive vs hard delete)
- Provide data export capability if needed

## Future Enhancements

- [ ] Token rotation/refresh support
- [ ] Per-channel incident mappings
- [ ] Slack app distribution (public installation)
- [ ] Multi-workspace support per organization
- [ ] Advanced permission management
- [ ] Slack command autocomplete
- [ ] Real-time presence indicators
- [ ] Slack workflow builder integration

## Support

For issues or questions:
- GitHub Issues: [timbuchinger/triage-tracker](https://github.com/timbuchinger/triage-tracker/issues)
- Documentation: `/docs/integrations/`
- Email: support@triage-tracker.example.com

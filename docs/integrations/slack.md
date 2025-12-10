# Slack Integration Guide

## Overview

The Triage Tracker Slack integration allows organizations to connect their Slack workspace to enable notifications, commands, and interactive incident management features.

## Features

- **Incident Notifications**: Automatically post incident updates to Slack channels
- **Interactive Components**: Manage incidents directly from Slack using buttons and menus
- **Slash Commands**: Quick actions via `/triage` commands (future feature)
- **Real-time Status Updates**: Keep your team informed as incidents progress

## Setup Instructions

### 1. Create a Slack App (for self-hosting)

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name your app (e.g., "Triage Tracker") and select your workspace
4. Click **Create App**

### 2. Configure OAuth & Permissions

1. Navigate to **OAuth & Permissions** in the sidebar
2. Add the following **Bot Token Scopes** (recommended):
   - `commands` — allow slash commands and opening modals
   - `chat:write` — post messages as the bot
   - `chat:write.public` — post to public channels the bot hasn't joined
   - `conversations.history` / `channels:history` & `groups:history` — read messages (used to fetch message content after reactions)
   - `reactions:read` — read reactions
   - `conversations:write` (or `channels:manage`) — create channels
   - `conversations.invite` — invite users to channels
   - `conversations.setTopic` — set channel topic
   - `conversations.join` / `channels:join` — join channels when needed
   - `users:read` — read user info

3. Add **Redirect URLs**:
   - Development: `http://localhost:3000/api/integrations/slack/callback`
   - Production: `https://your-domain.com/api/integrations/slack/callback`

### 3. Configure Event Subscriptions

1. Navigate to **Event Subscriptions** in the sidebar
2. Enable Events
3. Set **Request URL** for runtime events: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/events`
4. Subscribe to **Bot Events**:
   - `app_uninstalled` — detect when the app is removed and mark integration inactive
   - `reaction_added` — capture thumbs-up reactions and enqueue worker job to fetch message content

### 4. Configure Interactive Components (optional)

1. Navigate to **Interactivity & Shortcuts**
2. Enable Interactivity
3. Set **Request URL**: `https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/interactions`

### 5. Get Your Credentials

1. Navigate to **Basic Information**
2. Copy the following values:
   - **Client ID**
   - **Client Secret**
   - **Signing Secret**

### 6. Set Environment Variables

Add the following to your backend `.env` file:

```env
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_REDIRECT_URI=https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/callback
```

**Important**: Never commit these secrets to version control!

### 7. Install the App

1. Navigate to **Settings** in Triage Tracker
2. Click **Connect Slack Workspace**
3. You'll be redirected to Slack to authorize the app
4. Select the workspace and click **Allow**
5. You'll be redirected back to Triage Tracker

## Security

### Token Storage

- Bot and user tokens are encrypted before storage in the database
- Tokens are never logged or exposed in API responses
- Only organization admins can install/uninstall integrations

### Signature Verification

All incoming webhooks from Slack are verified using HMAC-SHA256 signatures with timestamp validation.

### CSRF Protection

The OAuth flow uses a cryptographically secure `state` parameter with 10-minute TTL.

## Troubleshooting

### "Invalid state parameter"

- The OAuth state may have expired (10-minute TTL)
- Try the connection flow again

### "Failed to exchange code for token"

- Verify `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are correct
- Ensure the redirect URI matches exactly in Slack app config

### "Invalid signature"

- Verify `SLACK_SIGNING_SECRET` is correct
- Check that the request came from Slack
- Ensure your server's clock is synchronized

## Development with ngrok

To test webhooks locally:

1. Install [ngrok](https://ngrok.com/)
3. Start ngrok: `ngrok http 3000`
4. Update Slack app URLs to use the ngrok URL
5. Update `SLACK_REDIRECT_URI` in `.env` (or use the manifest at `backend/docs/slack-manifest.yaml` which is already configured for the ngrok URL)

## Support

For issues: [GitHub Issues](https://github.com/timbuchinger/triage-tracker/issues)

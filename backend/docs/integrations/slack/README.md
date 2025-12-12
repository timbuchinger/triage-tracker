# Slack Manifest Generation

This folder contains a template and configuration for generating a Slack app manifest for local/dev testing.

## Files

- `manifest.template.yml` — Manifest template with placeholders for environment values
- `.env.slack` — Environment configuration with your ngrok URL and app settings
- `manifest.yml` — Generated manifest (auto-generated, do not edit manually)

## Quick Start

### 1. Update Configuration

Edit `.env.slack` with your ngrok URL or deployment URL:

```bash
APP_NAME="Triage Tracker"
REDIRECT_URL="https://your-ngrok-url.ngrok-free.app/api/integrations/slack/callback"
EVENTS_URL="https://your-ngrok-url.ngrok-free.app/api/integrations/slack/events"
INTERACTIVITY_URL="https://your-ngrok-url.ngrok-free.app/api/integrations/slack/interactive"
```

### 2. Generate the Manifest

From the backend directory, run:

```bash
npm run cmd:build-slack-manifest
```

Or from Docker:

```bash
docker compose -f docker-compose.dev.yml exec api npm run cmd:build-slack-manifest
```

This generates `manifest.yml` from the template using your `.env.slack` values.

### 3. Upload to Slack

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From an app manifest"
3. Select your workspace
4. Copy and paste the contents of `manifest.yml`
5. Review permissions and create the app

### 4. Configure OAuth Scopes

The manifest includes both bot and user scopes:

**Bot scopes** (for workspace integration):
- `commands`, `chat:write`, `chat:write.public`, `channels:read`, `channels:history`, `channels:manage`, `groups:read`, `users:read`, `reactions:read`, `incoming-webhook`, `app_mentions:read`

**User scopes** (for linking individual user accounts):
- `identity.basic`, `identity.email`, `identity.avatar`

### 5. Copy Credentials

After creating the app, copy these values to your `backend/.env`:

```bash
SLACK_CLIENT_ID=<from Basic Information>
SLACK_CLIENT_SECRET=<from Basic Information>
SLACK_SIGNING_SECRET=<from Basic Information>
SLACK_REDIRECT_URI=<same as REDIRECT_URL in .env.slack>
SLACK_BOT_TOKEN=<from OAuth & Permissions after installing>
```

## Slash Command Setup

The manifest automatically configures the `/inc` slash command with the correct request URL from your `.env.slack` file.

## Updating the Manifest

When your ngrok URL changes or you need to update settings:

1. Update `.env.slack` with new values
2. Run `npm run cmd:build-slack-manifest` to regenerate
3. In Slack App Manager → App Manifest → paste the updated manifest
4. Update `SLACK_REDIRECT_URI` in `backend/.env` to match

## Troubleshooting

- **404 errors**: Ensure URLs in `.env.slack` include the `/api` prefix and full path
- **OAuth errors**: Verify `SLACK_REDIRECT_URI` in `backend/.env` matches the redirect URL in the manifest
- **Permission errors**: Make sure both bot and user scopes are properly configured
- **Manifest validation errors**: Check that your ngrok URL is HTTPS and properly formatted

## Development Notes

- The generator script is at `backend/scripts/generate-slack-manifest.js`
- It automatically loads `.env.slack` from this directory
- Keep `manifest.yml` out of source control if it contains your specific ngrok URLs
- The template supports both local development (ngrok) and production deployments

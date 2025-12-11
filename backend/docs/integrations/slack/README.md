# Slack manifest generation

This folder contains a template and helper to generate a Slack app manifest for local/dev testing.

Files:

- `manifest.template.yml` — manifest with placeholders for environment values.
- `manifest.yml` — generated manifest (ignored by default; created by the script).

Quick start

1. Create a `.env` file (optional) with values:

```
APP_NAME="Triage Tracker"
EVENTS_URL="https://<your-ngrok>.io/api/integrations/slack/events"
INTERACTIVITY_URL="https://<your-ngrok>.io/api/integrations/slack/interactive"
```

2. Run the generator script from the repo root:

```bash
./scripts/generate-slack-manifest.sh --env-file .env
```

3. Upload `integrations/slack/manifest.yml` to Slack App Manager (https://api.slack.com/apps) using "Upload an app manifest".

Notes

- The generator tries to use `envsubst` if available, otherwise falls back to `sed` substitution.
- Keep `manifest.yml` out of source control while developing; commit only final versions if desired.

Slash commands

- Slack requires per-command Request URLs to be set in the App Manager UI (manifest cannot set `request_url` per command). Create the slash command using the Slack App Manager:
	- Command: `/triage`
	- Request URL: `https://<your-ngrok>.io/api/integrations/slack/commands/inc`
	- Short description: "Create or get triage information"

After creating the command in the UI, re-install the app (if required) and copy any new tokens/secrets into `backend/.env`.

Slash command setup (recommended)

If the `/inc` slash command does not exist in your Slack app, add it manually in the Slack App Manager using the steps below. Use the exact canonical endpoint the backend exposes so Slack calls reach the right controller.

1. Open your app in Slack App Manager: https://api.slack.com/apps → select your app
2. In the left menu select "Slash Commands" → "Create New Command"
3. Fill the form with these values:
	 - **Command**: `/inc`
	 - **Request URL**: `https://<your-host>/api/integrations/slack/commands/inc`
		 - Replace `https://<your-host>` with your public API host (ngrok or production domain).
		 - Note: the application sets a global prefix `api`, and the controller lives under `integrations/slack`, so the correct full path is `/api/integrations/slack/commands/inc`.
	 - **Short description**: `Open incident actions`
	 - **Usage hint**: `[status|create]`
4. Save the command.
5. (If prompted) Reinstall the app or reauthorize so Slack registers the new command with the app and tokens/permissions are refreshed.

Troubleshooting & tips

- If you see a 404 for `/api/slack/interactions` or `/api/slack/commands/inc`, make sure Slack is configured to call the canonical paths that include the `api` global prefix and `integrations/slack` path segment. Example canonical paths:
	- Slash command: `/api/integrations/slack/commands/inc`
	- Interactivity: `/api/integrations/slack/interactions`
	- Events: `/api/integrations/slack/events`
- The Slack app manifest cannot reliably set per-command `request_url` during upload; configure slash commands in the Slack App Manager UI as above.
- Use HTTPS and ensure the host you provide is reachable from Slack (ngrok is fine for local testing). If you change ngrok URL, reconfigure the command or re-upload the manifest as appropriate.
- If Slack reports an invalid parameter when trying to set the Request URL in the UI, double-check that the URL is a valid HTTPS URL and that it includes the full path (including `/api/...`).

If you want, I can produce a tiny checklist you can paste into the Slack UI or update the repository `CONTRIBUTING.md` with these steps.

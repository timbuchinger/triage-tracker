# Triage Tracker – Starter Stack

This repository contains a ready-to-run starter for **Triage Tracker**, an incident management app:

- Frontend: **Vue 3 + TypeScript + Vite + Tailwind v4 (config-style) + DaisyUI v5**
- Backend: **NestJS-style API (without CLI) using ts-node-dev**
- VS Code workspace & recommended extensions

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will start on http://localhost:5173.

### Backend

```bash
cd backend
npm install
npm run dev
```

The API will start on http://localhost:3000/api.

### Docker dev stack

```bash
DOCKER_CONFIG=/tmp/.docker docker compose -f docker-compose.dev.yml up -d
```

- Frontend: http://localhost:15173
- API: http://localhost:3000/api
- Postgres: `localhost:15432` (user: `triage`, password: `triage_password`)
- Redis: `localhost:16379`

Note on Redis eviction policy:

- The local `docker-compose` stacks previously used `--maxmemory-policy allkeys-lru`, which evicts keys when Redis is out of memory. The compose files have been updated to use `--maxmemory-policy noeviction` to avoid silent loss of critical data (job queues, locks, sessions). If Redis runs out of memory with `noeviction` enabled, it will return OOM errors instead of deleting keys — monitor memory usage and increase container/host memory as needed.

### VS Code

Open `triage-tracker.code-workspace` in VS Code for a preconfigured view with:

- Recommended extensions (Volar, Tailwind, ESLint, Prettier)
- Shared formatting settings

## Features

### Slack Integration

Triage Tracker includes a full OAuth-based Slack workspace integration:

- **Organization-level installation**: Org admins can connect their Slack workspace
- **Secure token storage**: Encrypted bot and user tokens with signature verification
- **Event handling**: Listens for app uninstall and other Slack events
- **Interactive UI**: Connect/disconnect via Settings → Integrations

See [docs/integrations/slack.md](docs/integrations/slack.md) for setup instructions.

### Environment Variables

Create `backend/.env` with:

```env
DATABASE_URL="postgresql://triage:triage_password@localhost:15432/triage?schema=public"
REDIS_URL="redis://localhost:16379"
SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"
SLACK_SIGNING_SECRET="your_slack_signing_secret"
SLACK_REDIRECT_URI="http://localhost:3000/api/integrations/slack/callback"
```

## Database Setup

```bash
cd backend
npm run db:seed  # Creates default organization and users
```

## Docs

- Slack integration setup guide: `docs/integrations/slack.md`
- Slack `/inc` integration plan and TDD matrix: `docs/slack-inc-flow.md`

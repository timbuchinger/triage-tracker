#!/usr/bin/env bash
set -euo pipefail

# Generates integrations/slack/manifest.yml from the template.
# Uses environment variables or a .env file to substitute placeholders.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/integrations/slack/manifest.template.yml"
OUT="$ROOT_DIR/integrations/slack/manifest.yml"

usage() {
  cat <<EOF
Usage: $0 [--env-file .env]

Creates "$OUT" from the template. Place values in environment variables:
  APP_NAME          e.g. "Triage Tracker"
  EVENTS_URL        e.g. https://ngrok.io/slack/events
  INTERACTIVITY_URL e.g. https://ngrok.io/slack/interactive

If --env-file is provided, it will be sourced first.
EOF
}

ENV_FILE=""
if [[ ${1:-} == "--env-file" ]]; then
  ENV_FILE="$2"
fi

if [[ -n "$ENV_FILE" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  else
    echo "Env file '$ENV_FILE' not found" >&2
    exit 2
  fi
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 2
fi

# Ensure required vars have values (but allow defaults)
: "${APP_NAME:=${APP_NAME:-Triage Tracker}}"
: "${EVENTS_URL:=${EVENTS_URL:-https://example.com/slack/events}}"
: "${INTERACTIVITY_URL:=${INTERACTIVITY_URL:-https://example.com/slack/interactive}}"

render_with_envsubst() {
  if command -v envsubst >/dev/null 2>&1; then
    envsubst < "$TEMPLATE" > "$OUT"
    return 0
  fi
  return 1
}

render_with_sed() {
    sed -e "s|\${APP_NAME}|${APP_NAME}|g" \
      -e "s|\${EVENTS_URL}|${EVENTS_URL}|g" \
      -e "s|\${INTERACTIVITY_URL}|${INTERACTIVITY_URL}|g" \
      "$TEMPLATE" > "$OUT"
}

if render_with_envsubst; then
  echo "Wrote $OUT (using envsubst)"
else
  render_with_sed
  echo "Wrote $OUT (using sed)"
fi

echo "To install the app in Slack for testing, upload '$OUT' in Slack App Manager -> 'Manage distribution' -> 'Upload an app manifest' or use the Slack API tooling."

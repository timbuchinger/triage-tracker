#!/usr/bin/env bash
set -euo pipefail

# Helper to regenerate the Slack manifest from the template.
# Usage: ./scripts/update-manifest.sh [--env-file path]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEN_SCRIPT="$ROOT_DIR/scripts/generate-slack-manifest.sh"

if [[ ${1:-} == "--env-file" ]]; then
  ENV_FILE="$2"
  exec "$GEN_SCRIPT" --env-file "$ENV_FILE"
else
  exec "$GEN_SCRIPT"
fi

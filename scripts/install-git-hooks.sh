#!/usr/bin/env bash
set -euo pipefail

# Installer for recommended git hooks. This sets the repo-local hooks path
# to `.githooks/` and copies a sample pre-commit hook that regenerates the
# Slack manifest when the template is changed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITHOOKS_DIR="$ROOT_DIR/.githooks"

mkdir -p "$GITHOOKS_DIR"

cat > "$GITHOOKS_DIR/pre-commit" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

# If the manifest template changed in this commit, regenerate the manifest
if git diff --cached --name-only | grep -q "integrations/slack/manifest.template.yml"; then
  echo "manifest.template.yml changed — regenerating manifest..."
  ./scripts/update-manifest.sh --env-file integrations/slack/.env.slack
  git add integrations/slack/manifest.yml
fi
HOOK

chmod +x "$GITHOOKS_DIR/pre-commit"

git config core.hooksPath "$GITHOOKS_DIR"

echo "Installed git hooks to $GITHOOKS_DIR and set core.hooksPath."

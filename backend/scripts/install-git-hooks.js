#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const GITHOOKS_DIR = path.join(ROOT_DIR, '.githooks');

fs.mkdirSync(GITHOOKS_DIR, { recursive: true });

const hook = `#!/usr/bin/env bash
set -euo pipefail

# If the manifest template changed in this commit, regenerate the manifest
if git diff --cached --name-only | grep -q "integrations/slack/manifest.template.yml"; then
  echo "manifest.template.yml changed — regenerating manifest..."
  node backend/scripts/update-manifest.js --env-file integrations/slack/.env.slack
  git add integrations/slack/manifest.yml
fi
`;

const hookPath = path.join(GITHOOKS_DIR, 'pre-commit');
fs.writeFileSync(hookPath, hook, { mode: 0o755 });

try {
  execSync(`git config core.hooksPath "${GITHOOKS_DIR}"`, { stdio: 'inherit' });
} catch (err) {
  // git might not be configured in some CI environments; still write the hook.
}

console.log(`Installed git hooks to ${GITHOOKS_DIR} and set core.hooksPath.`);

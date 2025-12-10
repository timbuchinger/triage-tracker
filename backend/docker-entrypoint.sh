#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] starting..."

# If node_modules is missing or empty, install dependencies deterministically when a lockfile is present.
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null || true)" ]; then
  echo "[entrypoint] node_modules missing or empty — installing dependencies"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
else
  echo "[entrypoint] node_modules present — skipping install"
fi

echo "[entrypoint] generating prisma client"
npx prisma generate

echo "[entrypoint] applying prisma migrations"
# Use migrate deploy in containers to avoid interactive prompts
npx prisma migrate deploy || {
  echo "[entrypoint] prisma migrate deploy failed — continuing to run container to allow debugging"
}

# Optional: run seed if DB_SEED=true
if [ "${DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running db seed"
  npm run db:seed
fi

echo "[entrypoint] executing command: $@"
exec "$@"

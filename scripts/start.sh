#!/bin/sh
# Production container start. Logs loudly and fails loudly so the platform's
# deploy logs show the real reason if startup ever breaks (instead of silence).
set -eu

PORT="${PORT:-3000}"

echo "[baton-start] node=$(node -v) cwd=$(pwd)"
echo "[baton-start] NODE_ENV=${NODE_ENV:-<unset>} PORT=${PORT} APP_URL=${APP_URL:-<unset>}"
echo "[baton-start] DATABASE_URL set: $([ -n "${DATABASE_URL:-}" ] && echo yes || echo NO)"
echo "[baton-start] .next present: $([ -d .next ] && echo yes || echo NO)"

echo "[baton-start] applying database schema (prisma db push)..."
npx prisma db push

echo "[baton-start] launching next start on 0.0.0.0:${PORT} ..."
# exec so Next becomes the main process (clean signals) and any non-zero exit
# is surfaced by the platform.
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT}"

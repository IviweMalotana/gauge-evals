#!/bin/bash
#
# SessionStart hook for Gauge (Claude Code on the web).
#
# Installs dependencies and prepares the local dev environment so tests, the
# typechecker, and the dev server work immediately. Runs synchronously.
#
# This environment's egress proxy blocks Prisma's telemetry host
# (checkpoint.prisma.io) and resets Prisma's own engine downloader, so we:
#   - disable the telemetry ping (CHECKPOINT_DISABLE=1), and
#   - fetch the Prisma engine binaries with curl (which the proxy allows).
#
set -euo pipefail

# Only run in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# --- Environment variables (also persisted for the rest of the session) ---
export CHECKPOINT_DISABLE=1
export PRISMA_HIDE_UPDATE_MESSAGE=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export CHECKPOINT_DISABLE=1'
    echo 'export PRISMA_HIDE_UPDATE_MESSAGE=1'
    echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
    echo 'export DATABASE_URL="file:./dev.db"'
  } >> "$CLAUDE_ENV_FILE"
fi

# --- Local .env (gitignored, so absent in a fresh clone) ---
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# --- Install dependencies ---
# --ignore-scripts avoids Prisma's postinstall (telemetry + engine fetch) and
# Playwright's browser download, both of which fail/aren't needed here.
echo "Installing npm dependencies..."
npm install --ignore-scripts

# --- Ensure Prisma query/schema engines are present ---
ENG_DIR="node_modules/@prisma/engines"
if ! ls "$ENG_DIR"/libquery_engine-*.so.node >/dev/null 2>&1; then
  echo "Fetching Prisma engine binaries via curl..."
  HASH="$(node -e "process.stdout.write(require('@prisma/engines-version').enginesVersion)")"
  PLATFORM="$(node -e "const g=require('@prisma/get-platform');Promise.resolve(typeof g.getPlatform==='function'?g.getPlatform():'debian-openssl-3.0.x').then(p=>process.stdout.write(String(p))).catch(()=>process.stdout.write('debian-openssl-3.0.x'))" 2>/dev/null || echo 'debian-openssl-3.0.x')"
  PLATFORM="${PLATFORM:-debian-openssl-3.0.x}"
  BASE="https://binaries.prisma.sh/all_commits/${HASH}/${PLATFORM}"
  mkdir -p "$ENG_DIR"
  curl -fsSL --retry 3 "$BASE/libquery_engine.so.node.gz" | gunzip > "$ENG_DIR/libquery_engine-${PLATFORM}.so.node"
  curl -fsSL --retry 3 "$BASE/schema-engine.gz" | gunzip > "$ENG_DIR/schema-engine-${PLATFORM}"
  chmod +x "$ENG_DIR/schema-engine-${PLATFORM}"
  # The `prisma` CLI package expects its own copy of the query engine.
  cp "$ENG_DIR/libquery_engine-${PLATFORM}.so.node" "node_modules/prisma/libquery_engine-${PLATFORM}.so.node"
fi

# --- Generate client, sync schema, seed (all idempotent) ---
echo "Generating Prisma client..."
npx prisma generate
echo "Syncing database schema..."
npx prisma db push --skip-generate
echo "Seeding demo data..."
npx tsx prisma/seed.ts || echo "Seed skipped (already applied)."

echo "Gauge dev environment ready."

#!/bin/bash
#
# Switch the Prisma datasource provider between SQLite (local/dev) and
# PostgreSQL (production). The data models are provider-agnostic (plain string
# columns, no SQLite/Postgres-specific types), so only the provider line and
# your DATABASE_URL need to change.
#
# Usage:
#   scripts/db-provider.sh postgresql
#   scripts/db-provider.sh sqlite
#
set -euo pipefail

TARGET="${1:-}"
SCHEMA="$(dirname "$0")/../prisma/schema.prisma"

case "$TARGET" in
  postgresql|postgres)
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
    echo "Prisma datasource set to postgresql."
    ;;
  sqlite)
    sed -i 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA"
    echo "Prisma datasource set to sqlite."
    ;;
  *)
    echo "Usage: $0 <postgresql|sqlite>" >&2
    exit 1
    ;;
esac

#!/bin/bash
# Daily Postgres backup (retain 7 days). Run on VPS via cron.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/postgres}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/project-dashboard}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
STAMP=$(date -u +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cd "$COMPOSE_DIR"

docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-project_user}" -d "${POSTGRES_DB:-project_dashboard}" -Fc \
  > "${BACKUP_DIR}/project_dashboard_${STAMP}.dump"

# prune old
find "$BACKUP_DIR" -name 'project_dashboard_*.dump' -type f -mtime +"${RETENTION_DAYS}" -delete

echo "Backup OK: ${BACKUP_DIR}/project_dashboard_${STAMP}.dump"

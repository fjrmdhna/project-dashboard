#!/bin/bash
set -euo pipefail
cd /opt/project-dashboard
set -a
# shellcheck disable=SC1091
source /opt/project-dashboard/.env
set +a

echo "==> Migrate data from Supabase Cloud"
mkdir -p /opt/project-dashboard/data/uploads/hermes-5g-uploads /tmp/mig-deps
docker run --rm --network project-dashboard_project_dashboard_network \
  -v /opt/project-dashboard:/work \
  -v /tmp/mig-deps:/deps -w /deps \
  -e SOURCE_SUPABASE_URL="$SOURCE_SUPABASE_URL" \
  -e SOURCE_SUPABASE_KEY="$SOURCE_SUPABASE_KEY" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  node:22-alpine sh -c 'npm init -y >/dev/null && npm install --silent @supabase/supabase-js@2 pg@8 && node /work/scripts/migrate-data-from-supabase.mjs'

echo "==> Storage migrate (best-effort)"
docker run --rm \
  -v /opt/project-dashboard:/work \
  -v /tmp/mig-deps:/deps -w /deps \
  -e SOURCE_SUPABASE_URL="$SOURCE_SUPABASE_URL" \
  -e SOURCE_SUPABASE_KEY="$SOURCE_SUPABASE_KEY" \
  -e UPLOADS_OUT=/work/data/uploads/hermes-5g-uploads \
  node:22-alpine sh -c 'npm install --silent @supabase/supabase-js@2 && node /work/scripts/migrate-storage-from-supabase.mjs' || echo STORAGE_SKIP

echo "==> Rebuild app"
docker compose up -d --build app

echo "==> Backup cron"
mkdir -p /opt/backups/postgres
cp scripts/pg-backup.sh /usr/local/bin/pg-backup-dashboard.sh
chmod +x /usr/local/bin/pg-backup-dashboard.sh
cat > /etc/cron.d/project-dashboard-pg-backup << 'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root cd /opt/project-dashboard && set -a && source /opt/project-dashboard/.env && set +a && /usr/local/bin/pg-backup-dashboard.sh >> /var/log/pg-backup-dashboard.log 2>&1
CRON

echo "==> Smoke"
sleep 15
docker compose ps
curl -sS -o /dev/null -w 'local_app %{http_code}\n' http://127.0.0.1:8080/api/health || true
curl -sS -w '\nrest_local %{http_code}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" "http://127.0.0.1:3001/site_data_5g?select=system_key&limit=1" | tail -5 || true
curl -sS -o /dev/null -w 'rest_nginx %{http_code}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" "https://nd-dashboard.cloud/rest/v1/site_data_5g?select=system_key&limit=1" || true
curl -sS -o /dev/null -w 'https_home %{http_code}\n' https://nd-dashboard.cloud/ || true
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 'site_data_5g' t, count(*) FROM site_data_5g UNION ALL SELECT 'site_data_aop', count(*) FROM site_data_aop UNION ALL SELECT 'site_data_caf', count(*) FROM site_data_caf UNION ALL SELECT 'site_data_tlp', count(*) FROM site_data_tlp;"

echo DEPLOY_DONE

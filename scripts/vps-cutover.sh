#!/bin/bash
set -euo pipefail
cd /opt/project-dashboard

cp -a .env ".env.cloud-backup.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
tar -xzf /tmp/migrate-vps.tgz
cp /tmp/vps-dashboard.env /opt/project-dashboard/.env
chmod 600 /opt/project-dashboard/.env

set -a
# shellcheck disable=SC1091
source /opt/project-dashboard/.env
set +a

echo "==> Start postgres redis postgrest"
docker compose up -d postgres redis
sleep 8
docker compose up -d postgrest
sleep 3
docker compose ps

echo "==> Apply schema"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < docker/postgres/schema-from-supabase.sql
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < docker/postgres/02-roles-grants.sql
docker compose restart postgrest
sleep 3

echo "==> Patch nginx /rest/v1/"
python3 << 'PY'
from pathlib import Path
p = Path('/etc/nginx/sites-available/nd-dashboard')
text = p.read_text()
marker = 'location /rest/v1/'
block = '''
    location /rest/v1/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_request_headers on;
        client_max_body_size 50M;
    }
'''
if marker in text:
    print('nginx rest already present')
else:
    needle = 'server_name nd-dashboard.cloud www.nd-dashboard.cloud;'
    idx = text.find(needle)
    if idx < 0:
        raise SystemExit('server_name not found')
    loc = text.find('location / {', idx)
    if loc < 0:
        raise SystemExit('location / not found')
    text = text[:loc] + block + '\n' + text[loc:]
    p.write_text(text)
    print('nginx rest location added')
PY
nginx -t
systemctl reload nginx

echo "==> Migrate data from Supabase Cloud"
mkdir -p /opt/project-dashboard/data/uploads/hermes-5g-uploads
docker run --rm --network project-dashboard_project_dashboard_network \
  -v /opt/project-dashboard:/work -w /work \
  -e SOURCE_SUPABASE_URL="$SOURCE_SUPABASE_URL" \
  -e SOURCE_SUPABASE_KEY="$SOURCE_SUPABASE_KEY" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  node:20-alpine sh -c 'npm init -y >/dev/null && npm install --silent @supabase/supabase-js@2 pg@8 && node scripts/migrate-data-from-supabase.mjs'

echo "==> Storage migrate (best-effort)"
docker run --rm --network project-dashboard_project_dashboard_network \
  -v /opt/project-dashboard:/work -w /work \
  -e SOURCE_SUPABASE_URL="$SOURCE_SUPABASE_URL" \
  -e SOURCE_SUPABASE_KEY="$SOURCE_SUPABASE_KEY" \
  -e UPLOADS_OUT=/work/data/uploads/hermes-5g-uploads \
  node:20-alpine sh -c 'npm init -y >/dev/null && npm install --silent @supabase/supabase-js@2 && node scripts/migrate-storage-from-supabase.mjs' || echo STORAGE_SKIP

echo "==> Rebuild app"
docker compose up -d --build app

echo "==> Backup cron"
mkdir -p /opt/backups/postgres
cp scripts/pg-backup.sh /usr/local/bin/pg-backup-dashboard.sh
chmod +x /usr/local/bin/pg-backup-dashboard.sh scripts/pg-backup.sh
# export env for cron
grep -E '^(POSTGRES_|COMPOSE)' .env > /opt/backups/postgres.env || true
cat > /etc/cron.d/project-dashboard-pg-backup << 'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root cd /opt/project-dashboard && set -a && source /opt/project-dashboard/.env && set +a && /usr/local/bin/pg-backup-dashboard.sh >> /var/log/pg-backup-dashboard.log 2>&1
CRON

echo "==> Smoke"
sleep 8
docker compose ps
curl -sS -o /dev/null -w 'local_app %{http_code}\n' http://127.0.0.1:8080/api/health || true
curl -sS -o /dev/null -w 'rest_local %{http_code}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" "http://127.0.0.1:3001/site_data_5g?select=system_key&limit=1" || true
curl -sS -o /dev/null -w 'rest_nginx %{http_code}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" "https://nd-dashboard.cloud/rest/v1/site_data_5g?select=system_key&limit=1" || true
curl -sS -o /dev/null -w 'https_home %{http_code}\n' https://nd-dashboard.cloud/ || true
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 'site_data_5g' t, count(*) FROM site_data_5g UNION ALL SELECT 'site_data_aop', count(*) FROM site_data_aop UNION ALL SELECT 'site_data_caf', count(*) FROM site_data_caf UNION ALL SELECT 'site_data_tlp', count(*) FROM site_data_tlp;"

echo DEPLOY_DONE

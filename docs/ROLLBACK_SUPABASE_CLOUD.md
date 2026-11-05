# Rollback: switch app back to Supabase Cloud

If cutover to VPS Postgres/PostgREST fails, restore cloud connection:

1. On VPS edit `/opt/project-dashboard/.env`:
   - `NEXT_PUBLIC_SUPABASE_URL=https://opecotutdvtahsccpqzr.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key>`
   - `SUPABASE_SERVICE_ROLE_KEY=<cloud service role key>`
   - Keep `POSTGRES_*` / `PGRST_*` as-is (unused by app when pointing to cloud)

2. Rebuild and restart:
   ```bash
   cd /opt/project-dashboard
   docker compose up -d --build app
   ```

3. Smoke test: `https://nd-dashboard.cloud/api/health` and a dashboard page.

4. VPS Postgres dump stays in `/opt/backups/postgres/` — do not delete until cloud is confirmed healthy.

5. Nginx `/rest/v1/` can remain; unused while app talks to `*.supabase.co`.

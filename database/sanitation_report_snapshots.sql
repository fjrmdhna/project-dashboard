-- Snapshot hourly untuk halaman /sanitation-report (1 baris 'latest').
-- Dijalankan di Postgres VPS (Supabase/PostgREST), BUKAN di PMIS prod.
CREATE TABLE IF NOT EXISTS public.sanitation_report_snapshots (
  id           text PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  payload      jsonb NOT NULL
);

REVOKE ALL ON public.sanitation_report_snapshots FROM anon, authenticated;
GRANT ALL ON public.sanitation_report_snapshots TO service_role;

NOTIFY pgrst, 'reload schema';


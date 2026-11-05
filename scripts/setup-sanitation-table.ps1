# Membuat tabel sanitation_report_snapshots di Postgres VPS (bukan PMIS prod).
# Jalankan: powershell -ExecutionPolicy Bypass -File scripts\setup-sanitation-table.ps1
# Password SSH diketik langsung di terminal.
$sql = (Get-Content (Join-Path $PSScriptRoot '..\database\sanitation_report_snapshots.sql') -Raw) -replace "`r", ""
$script = @"
docker exec -i project_dashboard_postgres sh -c 'psql -U "`$POSTGRES_USER" -d "`$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL_EOF'
$sql
SQL_EOF
"@
($script -replace "`r", "") | ssh root@148.230.96.170 'bash -s'

# Trigger snapshot Sanitation Report dari laptop.
# Prasyarat: laptop terhubung VPN PMIS (Cisco/OpenConnect) dan DBX "PMIS Prod" tersimpan.
# Jalankan:  powershell -ExecutionPolicy Bypass -File scripts\trigger-sanitation-snapshot.ps1
#            (atau klik kanan file ini -> Run with PowerShell; jendela menunggu Enter agar hasilnya terbaca)
# Opsi:      -ViaVps    jalankan collector di VPS (butuh tun0 aktif di VPS); SSH password diketik interaktif.
#            -DryRun    hanya hitung dan tampilkan ringkasan, tidak menulis snapshot.
#            -NoPause   jangan menunggu Enter di akhir (untuk dipanggil dari script/cron).
param([switch]$ViaVps, [switch]$DryRun, [switch]$NoPause)

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$exit = 0
try {
  if ($ViaVps) {
    ssh root@148.230.96.170 'cd /opt/project-dashboard && node scripts/sanitation-snapshot.mjs --require-vpn'
    if ($LASTEXITCODE -ne 0) { throw "ssh/collector gagal (exit $LASTEXITCODE)" }
  } else {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      throw 'Node.js tidak ditemukan di PATH. Install Node.js atau buka terminal yang sudah punya node.'
    }
    Push-Location $root
    try {
      if ($DryRun) { node scripts/sanitation-snapshot.mjs --dry-run } else { node scripts/sanitation-snapshot.mjs }
      if ($LASTEXITCODE -ne 0) { throw "Collector gagal (exit $LASTEXITCODE). Pastikan VPN PMIS tersambung." }
    } finally { Pop-Location }
  }
  Write-Host "`nSelesai." -ForegroundColor Green
} catch {
  Write-Host "`nGAGAL: $($_.Exception.Message)" -ForegroundColor Red
  $exit = 1
}
if (-not $NoPause) { Read-Host "`nTekan Enter untuk menutup" | Out-Null }
exit $exit

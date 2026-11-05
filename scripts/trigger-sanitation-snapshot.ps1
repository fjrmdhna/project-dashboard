# Trigger snapshot Sanitation Report dari laptop.
# Prasyarat: laptop terhubung VPN PMIS (Cisco/OpenConnect) dan DBX "PMIS Prod" tersimpan.
# Jalankan:  powershell -ExecutionPolicy Bypass -File scripts\trigger-sanitation-snapshot.ps1
# Opsi:      -ViaVps   -> jalankan collector di VPS (butuh tun0 aktif di VPS); SSH password diketik interaktif.
param([switch]$ViaVps, [switch]$DryRun)
$root = Join-Path $PSScriptRoot '..'
if ($ViaVps) {
  ssh root@148.230.96.170 'cd /opt/project-dashboard && node scripts/sanitation-snapshot.mjs --require-vpn'
} else {
  Push-Location $root
  try {
    if ($DryRun) { node scripts/sanitation-snapshot.mjs --dry-run } else { node scripts/sanitation-snapshot.mjs }
  } finally { Pop-Location }
}


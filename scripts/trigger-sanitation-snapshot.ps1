# Trigger snapshot Sanitation Report dari laptop (driver pg, lebih cepat dari DBX).
#
# Prasyarat: VPN PMIS aktif.
# Credential dibaca dari file di luar repo (jangan commit file itu).
# Default: C:\Users\ACER\OneDrive\Documents\PMIS\db_credential.txt
#   format: postgresql://USER:PASSWORD@HOST:5432/pmisdb_20261008
#   (password boleh berisi @; skrip akan encode otomatis)
#
# Jalankan:
#   powershell -ExecutionPolicy Bypass -File scripts\trigger-sanitation-snapshot.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\trigger-sanitation-snapshot.ps1 -DryRun
#   powershell -ExecutionPolicy Bypass -File scripts\trigger-sanitation-snapshot.ps1 -VerboseLog
#
# Opsi:
#   -ViaVps           jalankan collector di VPS (SSH); tidak memakai credential laptop
#   -DryRun           hitung saja, tidak menulis snapshot
#   -VerboseLog       tampilkan waktu tiap query
#   -CredentialFile   path file connection string (default: sibling PMIS\db_credential.txt)
#   -NoPause          jangan tunggu Enter di akhir
param(
  [switch]$ViaVps,
  [switch]$DryRun,
  [switch]$VerboseLog,
  [switch]$NoPause,
  [string]$CredentialFile = ''
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exit = 0

function Read-PmisDatabaseUrl([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "File credential tidak ditemukan: $path"
  }
  $raw = (Get-Content -LiteralPath $path -Raw).Trim()
  if (-not $raw) { throw "File credential kosong: $path" }
  # Ambil baris pertama yang tampak seperti URL postgres (abaikan komentar/baris kosong).
  $line = ($raw -split "(`r`n|`n|`r)" | ForEach-Object { $_.Trim() } | Where-Object {
    $_ -and ($_ -notmatch '^\s*#') -and ($_ -match '^postgres(ql)?://')
  } | Select-Object -First 1)
  if (-not $line) { throw "Tidak ada connection string postgresql:// di $path" }

  # Pisahkan userinfo / host di @ TERAKHIR agar password yang berisi @ tetap aman.
  $schemeSep = $line.IndexOf('://')
  if ($schemeSep -lt 0) { throw "Format URL tidak valid di $path" }
  $scheme = $line.Substring(0, $schemeSep)
  $rest = $line.Substring($schemeSep + 3)
  $at = $rest.LastIndexOf('@')
  if ($at -lt 0) { throw "URL tanpa @host di $path" }
  $userInfo = $rest.Substring(0, $at)
  $hostPart = $rest.Substring($at + 1)
  $colon = $userInfo.IndexOf(':')
  if ($colon -lt 0) { throw "URL tanpa user:password di $path" }
  $user = $userInfo.Substring(0, $colon)
  $pass = $userInfo.Substring($colon + 1)
  $encUser = [uri]::EscapeDataString($user)
  $encPass = [uri]::EscapeDataString($pass)
  # Host/port/db tidak di-encode ulang (boleh sudah valid).
  return "${scheme}://${encUser}:${encPass}@${hostPart}"
}

try {
  if ($ViaVps) {
    Write-Host "Menjalankan collector di VPS..." -ForegroundColor Cyan
    ssh root@148.230.96.170 'cd /opt/project-dashboard && node scripts/sanitation-snapshot.mjs --require-vpn'
    if ($LASTEXITCODE -ne 0) { throw "ssh/collector gagal (exit $LASTEXITCODE)" }
  } else {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      throw 'Node.js tidak ditemukan di PATH. Install Node.js atau buka terminal yang sudah punya node.'
    }

    if (-not $CredentialFile) {
      # project-dashboard -> sibling PMIS\db_credential.txt
      $CredentialFile = Join-Path (Split-Path $root -Parent) 'db_credential.txt'
    }
    $CredentialFile = (Resolve-Path -LiteralPath $CredentialFile).Path
    $env:PMIS_DATABASE_URL = Read-PmisDatabaseUrl $CredentialFile

    # Host saja untuk log (tanpa user/password).
    $hostOnly = 'unknown'
    if ($env:PMIS_DATABASE_URL -match '@([^:/]+)') { $hostOnly = $Matches[1] }
    Write-Host "Mode pg (laptop) via credential file" -ForegroundColor Cyan
    Write-Host "  file: $CredentialFile"
    Write-Host "  host: $hostOnly"

    if ($VerboseLog) { $env:SANITATION_VERBOSE = '1' }

    Push-Location $root
    try {
      if ($DryRun) {
        Write-Host "Dry-run: tidak menulis snapshot.`n" -ForegroundColor Yellow
        node scripts/sanitation-snapshot.mjs --dry-run
      } else {
        node scripts/sanitation-snapshot.mjs
      }
      if ($LASTEXITCODE -ne 0) {
        throw "Collector gagal (exit $LASTEXITCODE). Pastikan VPN PMIS tersambung dan credential benar."
      }
    } finally {
      Pop-Location
      Remove-Item Env:PMIS_DATABASE_URL -ErrorAction SilentlyContinue
      if ($VerboseLog) { Remove-Item Env:SANITATION_VERBOSE -ErrorAction SilentlyContinue }
    }
  }
  Write-Host "`nSelesai." -ForegroundColor Green
} catch {
  Write-Host "`nGAGAL: $($_.Exception.Message)" -ForegroundColor Red
  $exit = 1
}
if (-not $NoPause) { Read-Host "`nTekan Enter untuk menutup" | Out-Null }
exit $exit

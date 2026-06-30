/**
 * Upload TLP New Site Excel directly to Supabase (bypasses Next.js body limits).
 *
 * Usage:
 *   node scripts/upload-tlp-excel.mjs "C:/path/to/file.xlsx"
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(join(PROJECT_ROOT, '.env.local'))
loadEnvFile(join(PROJECT_ROOT, '.env'))

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://opecotutdvtahsccpqzr.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Using fallback anon key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local for production uploads.'
  )
}

const BATCH_SIZE = 500

const HEADER_TO_DB = {
  system_key: 'system_key',
  'SBOQ.project_type': 'SBOQ.project_type',
  network_header: 'network_header',
  project_name: 'project_name',
  program_name: 'program_name',
  program_group: 'program_group',
  site_id: 'site_id',
  site_name: 'site_name',
  wbs_status: 'wbs_status',
  year: 'year',
  new_site_id: 'new_site_id',
  new_site_name: 'new_site_name',
  region: 'region',
  ran_vendor: 'ran_vendor',
  region_circle: 'region_circle',
  site_category: 'site_category',
  twr_owner: 'twr_owner',
  vendor_code: 'vendor_code',
  wo_number_1: 'wo_number_1',
  ic_000010_bf: 'ic_000010_bf',
  ic_000010_ff: 'ic_000010_ff',
  ic_000010_af: 'ic_000010_af',
  rfi_accepted: 'rfi_accepted',
  site_status: 'site_status',
  return_replacement_status: 'return_replacement_status',
  progress_status: 'progress_status',
  issue_category: 'issue_category',
  price_month_actual: 'price_month_actual',
  site_id_tlp: 'site_id_tlp',
  bauf_date: 'bauf_date',
  lease_start_clause: 'lease_start_clause',
  lease_start_date: 'lease_start_date',
  administration_status: 'administration_status',
  booking_status: 'booking_status',
  issue_ny_sc: 'issue_ny_sc',
  iom_date: 'iom_date',
  iom_number: 'iom_number',
  sc_number: 'sc_number',
  po_number: 'po_number',
  baps_submit_date: 'baps_submit_date',
  baps_number: 'baps_number',
  baps_date: 'baps_date',
  baps_status: 'baps_status',
  audit: 'audit',
}

const DATE_COLUMNS = new Set([
  'ic_000010_bf',
  'ic_000010_ff',
  'ic_000010_af',
  'rfi_accepted',
  'bauf_date',
  'lease_start_date',
  'iom_date',
  'baps_submit_date',
  'baps_date',
])

function excelSerialToIsoDate(serial) {
  if (serial < 1 || serial > 2958465) return null
  const actualDays = serial >= 60 ? serial - 2 : serial - 1
  const epoch = Date.UTC(1900, 0, 1)
  const target = new Date(epoch + actualDays * 86400000)
  const y = target.getUTCFullYear()
  const m = String(target.getUTCMonth() + 1).padStart(2, '0')
  const d = String(target.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseTlpDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return excelSerialToIsoDate(Math.floor(value))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
    }
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }
  return null
}

function mapRow(row) {
  const mapped = {}
  for (const [header, rawValue] of Object.entries(row)) {
    const dbColumn = HEADER_TO_DB[header]
    if (!dbColumn) continue
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      mapped[dbColumn] = null
      continue
    }
    if (DATE_COLUMNS.has(dbColumn)) {
      mapped[dbColumn] = parseTlpDate(rawValue)
    } else if (typeof rawValue === 'string') {
      mapped[dbColumn] = rawValue.trim() || null
    } else {
      mapped[dbColumn] = rawValue
    }
  }
  if (!mapped.system_key || String(mapped.system_key).trim() === '') return null
  mapped.system_key = String(mapped.system_key).trim()
  return mapped
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, header: 1, defval: null, blankrows: false })
  if (rows.length < 2) throw new Error('Excel must have header on row 2')
  const headers = rows[1].map((h, i) => (h === null || h === undefined || h === '' ? `Column_${i + 1}` : String(h).trim()))
  const out = []
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.some((c) => c !== null && c !== undefined && c !== '')) continue
    const obj = {}
    headers.forEach((h, j) => {
      obj[h] = row[j] === '' || row[j] === undefined ? null : row[j]
    })
    out.push(obj)
  }
  return out
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node scripts/upload-tlp-excel.mjs <path-to-xlsx>')
    process.exit(1)
  }

  console.log(`Reading ${filePath}...`)
  const buffer = readFileSync(filePath)
  console.log(`File size: ${(buffer.length / 1024).toFixed(0)} KB`)

  const rawRows = parseExcel(buffer)
  console.log(`Parsed ${rawRows.length} data rows`)

  const mappedRows = []
  const errors = []
  for (let i = 0; i < rawRows.length; i++) {
    const mapped = mapRow(rawRows[i])
    if (mapped) mappedRows.push(mapped)
    else errors.push({ row: i + 3, error: 'Missing system_key' })
  }
  console.log(`Valid rows: ${mappedRows.length}, skipped: ${errors.length}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  let upserted = 0
  const batchErrors = []

  for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
    const batch = mappedRows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('site_data_tlp')
      .upsert(batch, { onConflict: 'system_key', ignoreDuplicates: false })

    if (error) {
      batchErrors.push({ batchStart: i + 3, error: error.message })
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
    } else {
      upserted += batch.length
      process.stdout.write(`\rUpserted ${upserted}/${mappedRows.length} rows...`)
    }
  }

  console.log('\nDone.')
  const summary = {
    totalRows: rawRows.length,
    upserted,
    validationErrors: errors.length,
    batchErrors,
  }
  console.log(JSON.stringify(summary, null, 2))

  // Spot-check: count rows in DB (best-effort)
  const { count, error: countError } = await supabase
    .from('site_data_tlp')
    .select('system_key', { count: 'exact', head: true })
  if (!countError) {
    console.log(`Supabase site_data_tlp row count: ${count ?? 'unknown'}`)
  }

  if (batchErrors.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Upload AOP Excel directly to Supabase (bypasses Next.js body limits).
 *
 * Usage:
 *   node scripts/upload-aop-excel.mjs "C:/path/to/file.xlsx"
 *
 * Optional env:
 *   SUPABASE_SERVICE_ROLE_KEY — preferred for upsert
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://opecotutdvtahsccpqzr.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU'

const BATCH_SIZE = 500

const HEADER_TO_DB = {
  system_key: 'system_key',
  'SBOQ.project_type': 'project_type',
  site_id: 'site_id',
  site_name: 'site_name',
  'RF.region': 'region',
  region_circle: 'region_circle',
  site_category: 'site_category',
  site_status: 'site_status',
  project_name: 'project_name',
  vendor_name: 'vendor_name',
  scope_category: 'scope_category',
  year: 'year',
  wbs_status: 'wbs_status',
  ran_score: 'ran_score',
  program_report: 'program_report',
  issue_category: 'issue_category',
  ic_000010_af: 'ic_000010_af',
  rfi_accepted: 'rfi_accepted',
  rfs_af: 'rfs_af',
  rfs_ff: 'rfs_ff',
  rfs_bf: 'rfs_bf',
  rfs_forecast: 'rfs_forecast',
  rfs_actual: 'rfs_actual',
  mocn_activation_forecast: 'mocn_activation_forecast',
  hotnews_af: 'hotnews_af',
  endorse_af: 'endorse_af',
  pac_accepted_af: 'pac_accepted_af',
  mos_af: 'mos_af',
  imp_integ_af: 'imp_integ_af',
  rfc_approved: 'rfc_approved',
  priority_congest_urgent: 'priority_congest_urgent',
  tx_vendor: 'tx_vendor',
  po_date: 'po_date',
  long: 'long',
  lat: 'lat',
  ic_000040_af: 'ic_000040_af',
  patp_accepted_af: 'patp_accepted_af',
  ready_for_acpt_date: 'ready_for_acpt_date',
  po_number: 'po_number',
  pic_indosat: 'pic_indosat',
  rfs_forecast_lock: 'rfs_forecast_lock',
  fatp_accepted_af: 'fatp_accepted_af',
  pm_indosat: 'pm_indosat',
}

const TIMESTAMP_COLUMNS = new Set([
  'ic_000010_af', 'rfi_accepted', 'rfs_af', 'rfs_ff', 'rfs_bf', 'rfs_forecast', 'rfs_actual',
  'mocn_activation_forecast', 'hotnews_af', 'endorse_af', 'pac_accepted_af', 'mos_af',
  'imp_integ_af', 'rfc_approved', 'ready_for_acpt_date', 'rfs_forecast_lock',
  'fatp_accepted_af', 'patp_accepted_af',
])
const DATE_COLUMNS = new Set(['ic_000040_af', 'po_date'])

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

function parseAopDate(value) {
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
    if (TIMESTAMP_COLUMNS.has(dbColumn)) {
      const date = parseAopDate(rawValue)
      mapped[dbColumn] = date ? `${date}T00:00:00` : null
    } else if (DATE_COLUMNS.has(dbColumn)) {
      mapped[dbColumn] = parseAopDate(rawValue)
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
    console.error('Usage: node scripts/upload-aop-excel.mjs <path-to-xlsx>')
    process.exit(1)
  }

  console.log(`Reading ${filePath}...`)
  const buffer = readFileSync(filePath)
  console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

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
      .from('site_data_aop')
      .upsert(batch, { onConflict: 'system_key', ignoreDuplicates: false })

    if (error) {
      batchErrors.push({ batchStart: i + 3, error: error.message })
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
    } else {
      upserted += batch.length
      process.stdout.write(`\rUpserted ${upserted}/${mappedRows.length} rows...`)
    }
  }

  console.log('\nDone.')
  console.log(JSON.stringify({
    totalRows: rawRows.length,
    upserted,
    validationErrors: errors.length,
    batchErrors,
  }, null, 2))

  if (batchErrors.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

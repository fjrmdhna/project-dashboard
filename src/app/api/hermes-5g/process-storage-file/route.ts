/**
 * Opsi 1: Upload Excel ke Supabase Storage dulu, lalu panggil API ini dengan filePath.
 * Menghindari limit body 4.5MB Vercel — request body hanya { filePath }.
 * Requires: SUPABASE_SERVICE_ROLE_KEY, bucket hermes-5g-uploads.
 */
import { NextResponse } from 'next/server'

export const maxDuration = 60
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'hermes-5g-uploads'
const BATCH_SIZE = 500

const DATE_COLUMNS = new Set([
  'imp_integ_ff', 'imp_integ_af', 'rfs_ff', 'rfs_af', 'rfc_approved',
  'hotnews_af', 'endorse_af', 'pac_accepted_af', '5g_readiness_date', '5g_activation_date',
  'cx_submitted', 'cx_approved', 'RF_Fusion.cutover_af', 'rfs_bf', 'mocn_activation_forecast',
  'rfs_forecast_lock', 'caf_approved', 'mos_af', 'cluster_acceptance_af', 'ic_000040_af', 'patp_accepted_af',
])

const HEADER_TO_DB: Record<string, string> = {
  system_key: 'system_key', 'SBOQ.project_type': 'SBOQ.project_type',
  vendor_code: 'vendor_code', vendor_name: 'vendor_name', wbs_status: 'wbs_status',
  site_id: 'site_id', site_name: 'site_name', new_site_id: 'new_site_id', new_site_name: 'new_site_name',
  unique_id: 'unique_id', relo_id: 'relo_id', relo_name: 'relo_name', site_category: 'site_category',
  po_number: 'po_number', po_subline: 'po_subline', network_header: 'network_header', year: 'year',
  program_name: 'program_name', project_name: 'project_name', program: 'program', program_report: 'program_report',
  ran_score: 'ran_score', region: 'region', region_wise: 'region_wise', region_circle: 'region_circle',
  nano_cluster: 'nano_cluster', twr_owner: 'twr_owner', long: 'long', lat: 'lat',
  scope_of_work: 'scope_of_work', issue_category: 'issue_category', site_status: 'site_status',
  highlevel_issue: 'highlevel_issue', ran_scope: 'ran_scope', scope_category: 'scope_category',
  imp_ttp: 'imp_ttp', mc_cluster: 'mc_cluster',
  imp_integ_ff: 'imp_integ_ff', imp_integ_af: 'imp_integ_af', rfs_ff: 'rfs_ff', rfs_af: 'rfs_af',
  rfc_approved: 'rfc_approved', hotnews_af: 'hotnews_af', endorse_af: 'endorse_af', pac_accepted_af: 'pac_accepted_af',
  '5g_readiness_date': '5g_readiness_date', '5g_activation_date': '5g_activation_date',
  cx_submitted: 'cx_submitted', cx_approved: 'cx_approved', cx_acceptance_status: 'cx_acceptance_status', cx_remark: 'cx_remark',
  'RF_Fusion.cutover_af': 'RF_Fusion.cutover_af', rfs_bf: 'rfs_bf',
  mocn_activation_forecast: 'mocn_activation_forecast', rfs_forecast_lock: 'rfs_forecast_lock',
  caf_approved: 'caf_approved', mos_af: 'mos_af', cluster_acceptance_af: 'cluster_acceptance_af',
  'ic_000040_af': 'ic_000040_af', patp_accepted_af: 'patp_accepted_af',
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && value >= 1 && value <= 2958465) {
    const d = new Date((value - 25569) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const d = new Date(value.trim())
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const dbCol = HEADER_TO_DB[key]
    if (!dbCol) continue
    let v = value === '' || value === undefined ? null : value
    if (DATE_COLUMNS.has(dbCol)) v = parseDate(v)
    else if ((dbCol === 'long' || dbCol === 'lat') && v !== null) {
      const n = Number(v)
      v = isNaN(n) ? null : n
    } else if (typeof v === 'string') v = v.trim() || null
    out[dbCol] = v
  }
  const sk = (out.system_key ?? row.system_key ?? row.systemkey) as string
  if (!sk || String(sk).trim() === '') return null
  out.system_key = String(sk).trim()
  return out
}

function parseExcel(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet || !sheet['!ref']) throw new Error('Empty or invalid sheet')
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, header: 1, defval: null }) as unknown[][]
  if (rows.length < 2) throw new Error('Need at least header row (row 2)')
  const headers = (rows[1] as unknown[]).map((h, i) => String(h ?? '').trim() || `Column_${i + 1}`)
  const out: Record<string, unknown>[] = []
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row?.some((c) => c !== null && c !== undefined && c !== '')) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, j) => {
      obj[h] = row[j] === '' || row[j] === undefined ? null : row[j]
    })
    out.push(obj)
  }
  return out
}

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required')
  return createClient(url, key)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const filePath = typeof body?.filePath === 'string' ? body.filePath.trim() : ''
    if (!filePath) {
      return NextResponse.json(
        { success: false, message: 'Body must be JSON with filePath: string (path in bucket hermes-5g-uploads)' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseService()

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(filePath)

    if (downloadError) {
      return NextResponse.json(
        { success: false, message: `Storage download failed: ${downloadError.message}. Ensure bucket "${BUCKET}" exists and filePath is correct.` },
        { status: 400 }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let rows: Record<string, unknown>[]
    try {
      rows = parseExcel(buffer)
    } catch (e) {
      return NextResponse.json(
        { success: false, message: `Parse error: ${e instanceof Error ? e.message : String(e)}` },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No data rows (row 3+)' },
        { status: 400 }
      )
    }

    const mapped: Record<string, unknown>[] = []
    const errors: { row: number; error: string }[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = mapRow(rows[i])
      if (row) mapped.push(row)
      else errors.push({ row: i + 3, error: 'Missing or empty system_key' })
    }

    if (mapped.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid rows', errors },
        { status: 400 }
      )
    }

    let inserted = 0
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('site_data_5g')
        .upsert(batch, { onConflict: 'system_key', ignoreDuplicates: false })
      if (error) errors.push({ row: i + 3, error: error.message })
      else inserted += batch.length
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      insertedCount: inserted,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

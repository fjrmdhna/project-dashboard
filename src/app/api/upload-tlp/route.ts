import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { getServerSupabase } from '@/lib/server-supabase'
import {
  deleteStaleRowsBySystemKey,
  normalizeSystemKey,
  systemKeySetFromRows,
} from '@/lib/supabase-site-sync'
import {
  parseExcelSkipFirstRow,
  readExcelUploadFile,
  stringOrNull,
  toDateOnly,
  upsertChunks,
  type ExcelRow,
} from '@/lib/upload-gateway-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function mapTlpRow(row: ExcelRow): Record<string, unknown> | null {
  const systemKey = normalizeSystemKey(row.system_key)
  if (!systemKey) return null

  return {
    system_key: systemKey,
    'SBOQ.project_type': stringOrNull(row['SBOQ.project_type']),
    network_header: stringOrNull(row.network_header),
    project_name: stringOrNull(row.project_name),
    program_name: stringOrNull(row.program_name),
    site_id: stringOrNull(row.site_id),
    site_name: stringOrNull(row.site_name),
    wbs_status: stringOrNull(row.wbs_status),
    year: stringOrNull(row.year),
    new_site_id: stringOrNull(row.new_site_id),
    new_site_name: stringOrNull(row.new_site_name),
    region: stringOrNull(row.region),
    site_category: stringOrNull(row.site_category),
    twr_owner: stringOrNull(row.twr_owner),
    vendor_code: stringOrNull(row.vendor_code),
    'MTWS.wo_number': stringOrNull(row['MTWS.wo_number']),
    wo_number_1: stringOrNull(row.wo_number_1),
    wo_date_1: toDateOnly(row.wo_date_1),
    bauf_actual: toDateOnly(row.bauf_actual),
    ic_000010_bf: toDateOnly(row.ic_000010_bf),
    ic_000010_ff: toDateOnly(row.ic_000010_ff),
    ic_000010_af: toDateOnly(row.ic_000010_af),
    rfi_accepted: toDateOnly(row.rfi_accepted),
    site_status: stringOrNull(row.site_status),
    progress_status: stringOrNull(row.progress_status),
    fe_readiness_plan: toDateOnly(row.fe_readiness_plan),
    issue_category: stringOrNull(row.issue_category),
    'Opticalization.site_status': stringOrNull(row['Opticalization.site_status']),
    'Opticalization.rfs_ff': toDateOnly(row['Opticalization.rfs_ff']),
    'RF.rfs_af': toDateOnly(row['RF.rfs_af']),
    price_month_actual: stringOrNull(row.price_month_actual),
    site_id_tlp: stringOrNull(row.site_id_tlp),
    bauf_date: toDateOnly(row.bauf_date),
    lease_start_clause: stringOrNull(row.lease_start_clause),
    lease_start_date: toDateOnly(row.lease_start_date),
    administration_status: stringOrNull(row.administration_status),
    booking_status: stringOrNull(row.booking_status),
    issue_ny_sc: stringOrNull(row.issue_ny_sc),
    iom_date: toDateOnly(row.iom_date),
    iom_number: stringOrNull(row.iom_number),
    sc_number: stringOrNull(row.sc_number),
    po_number: stringOrNull(row.po_number),
    baps_submit_date: toDateOnly(row.baps_submit_date),
    baps_number: stringOrNull(row.baps_number),
    baps_date: toDateOnly(row.baps_date),
    baps_status: stringOrNull(row.baps_status),
    audit: stringOrNull(row.audit),
    'Opticalization.rfs_af': toDateOnly(row['Opticalization.rfs_af']),
    'Document.project': stringOrNull(row['Document.project']),
  }
}

export async function POST(request: Request) {
  try {
    const authError = requireApiKey(request, ['PMIS_TLP_API_KEY', 'TLP_API_KEY', 'API_KEY'])
    if (authError) return authError

    const fileResult = await readExcelUploadFile(request)
    if ('error' in fileResult) return fileResult.error

    const jsonData = parseExcelSkipFirstRow(fileResult.buffer, { cellDates: true })
    const transformedData = jsonData
      .map(mapTlpRow)
      .filter((row): row is Record<string, unknown> => row !== null)

    console.log(`[upload-tlp] file=${fileResult.file.name} rows=${transformedData.length}`)

    const supabase = getServerSupabase()
    await upsertChunks(supabase, 'site_data_tlp', transformedData)

    // Full-snapshot stale cleanup only when upload looks like a complete dump
    // (avoids wiping production data / nginx 414 on tiny/partial files).
    let deletedCount = 0
    let staleSyncError: { message: string } | null = null
    if (transformedData.length >= 100) {
      const currentKeys = systemKeySetFromRows(transformedData)
      const sync = await deleteStaleRowsBySystemKey(supabase, 'site_data_tlp', currentKeys)
      deletedCount = sync.deletedCount
      staleSyncError = sync.error
    }

    if (staleSyncError) {
      console.error('[upload-tlp] Stale row sync failed:', staleSyncError.message)
    }

    return NextResponse.json({
      success: !staleSyncError,
      message: 'Upload successful',
      totalRows: transformedData.length,
      deletedRows: deletedCount,
      staleSyncError: staleSyncError?.message ?? null,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[upload-tlp] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

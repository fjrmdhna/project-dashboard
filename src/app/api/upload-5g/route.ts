import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { getServerSupabase } from '@/lib/server-supabase'
import { normalizeSystemKey } from '@/lib/supabase-site-sync'
import {
  excelDateToISO,
  numberOrNull,
  parseExcelSkipFirstRow,
  readExcelUploadFile,
  stringOrNull,
  upsertChunks,
  type ExcelRow,
} from '@/lib/upload-gateway-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const EXCLUDED_PROGRAM_REPORT = 'Hermes Project - 3MBps - 579 sites'

function map5gRow(row: ExcelRow): Record<string, unknown> | null {
  const systemKey = normalizeSystemKey(row.system_key)
  if (!systemKey) return null

  return {
    system_key: systemKey,
    'SBOQ.project_type': stringOrNull(row['SBOQ.project_type']),
    vendor_code: stringOrNull(row.vendor_code),
    vendor_name: stringOrNull(row.vendor_name),
    wbs_status: stringOrNull(row.wbs_status),
    site_id: stringOrNull(row.site_id),
    site_name: stringOrNull(row.site_name),
    new_site_id: stringOrNull(row.new_site_id),
    new_site_name: stringOrNull(row.new_site_name),
    unique_id: stringOrNull(row.unique_id),
    relo_id: stringOrNull(row.relo_id),
    relo_name: stringOrNull(row.relo_name),
    site_category: stringOrNull(row.site_category),
    po_number: stringOrNull(row.po_number),
    po_subline: stringOrNull(row.po_subline),
    po_date: excelDateToISO(row.po_date),
    network_header: stringOrNull(row.network_header),
    year: stringOrNull(row.year),
    program_name: stringOrNull(row.program_name),
    project_name: stringOrNull(row.project_name),
    program: stringOrNull(row.program),
    program_report: stringOrNull(row.program_report),
    ran_score: stringOrNull(row.ran_score),
    region: stringOrNull(row.region),
    region_wise: stringOrNull(row.region_wise),
    region_circle: stringOrNull(row.region_circle),
    nano_cluster: stringOrNull(row.nano_cluster),
    dati_ii: stringOrNull(row.dati_ii),
    province: stringOrNull(row.province),
    kecamatan: stringOrNull(row.kecamatan),
    sales_area: stringOrNull(row.sales_area),
    mc_cluster: stringOrNull(row.mc_cluster),
    twr_owner: stringOrNull(row.twr_owner),
    long: numberOrNull(row.long),
    lat: numberOrNull(row.lat),
    scope_of_work: stringOrNull(row.scope_of_work),
    issue_category: stringOrNull(row.issue_category),
    site_status: stringOrNull(row.site_status),
    highlevel_issue: stringOrNull(row.highlevel_issue),
    ran_scope: stringOrNull(row.ran_scope),
    scope_category: stringOrNull(row.scope_category),
    imp_ttp: stringOrNull(row.imp_ttp),
    priority_congest_urgent: stringOrNull(row.priority_congest_urgent),
    prio_type: stringOrNull(row.prio_type),
    ic_000010_af: excelDateToISO(row.ic_000010_af),
    rfi_accepted: excelDateToISO(row.rfi_accepted),
    caf_submitted: excelDateToISO(row.caf_submitted),
    ftr_submit: excelDateToISO(row.ftr_submit),
    permit_af: excelDateToISO(row.permit_af),
    imp_integ_ff: excelDateToISO(row.imp_integ_ff),
    imp_integ_af: excelDateToISO(row.imp_integ_af),
    ready_for_acpt_date: excelDateToISO(row.ready_for_acpt_date),
    rfs_ff: excelDateToISO(row.rfs_ff),
    rfs_af: excelDateToISO(row.rfs_af),
    rfs_bf: excelDateToISO(row.rfs_bf),
    rfs_actual: excelDateToISO(row.rfs_actual),
    rfs_forecast: excelDateToISO(row.rfs_forecast),
    rfc_approved: excelDateToISO(row.rfc_approved),
    hotnews_af: excelDateToISO(row.hotnews_af),
    endorse_af: excelDateToISO(row.endorse_af),
    pac_accepted_af: excelDateToISO(row.pac_accepted_af),
    patp_accepted_af: excelDateToISO(row.patp_accepted_af),
    pic_indosat: stringOrNull(row.pic_indosat),
    donor_id: stringOrNull(row.donor_id),
    donor_name: stringOrNull(row.donor_name),
    'CR.cr_number': stringOrNull(row['CR.cr_number']),
    'CR.cr_status': stringOrNull(row['CR.cr_status']),
    'TLP.SBOQ.system_key': stringOrNull(row['TLP.SBOQ.system_key']),
    'TLP.site_id': stringOrNull(row['TLP.site_id']),
    'TLP.site_status': stringOrNull(row['TLP.site_status']),
    'TLP.issue_category': stringOrNull(row['TLP.issue_category']),
    'TLP.ic_000010_ff': excelDateToISO(row['TLP.ic_000010_ff']),
    'TLP.ic_000010_af': excelDateToISO(row['TLP.ic_000010_af']),
    'TLP.fe_readiness_plan': excelDateToISO(row['TLP.fe_readiness_plan']),
    'TLP.rfi_accepted': excelDateToISO(row['TLP.rfi_accepted']),
    'Opticalization.SBOQ.system_key': stringOrNull(row['Opticalization.SBOQ.system_key']),
    'Opticalization.site_id': stringOrNull(row['Opticalization.site_id']),
    'Opticalization.site_status': stringOrNull(row['Opticalization.site_status']),
    'Opticalization.rfs_ff': excelDateToISO(row['Opticalization.rfs_ff']),
    short_extention: stringOrNull(row.short_extention),
    readiness_2600_af: excelDateToISO(row.readiness_2600_af),
    activation_2600_af: excelDateToISO(row.activation_2600_af),
    readiness_700_af: excelDateToISO(row.readiness_700_af),
    activation_700_af: excelDateToISO(row.activation_700_af),
    '5g_readiness_date': excelDateToISO(row['5g_readiness_date']),
    '5g_activation_date': excelDateToISO(row['5g_activation_date']),
    'RF_Fusion.cutover_af': excelDateToISO(row['RF_Fusion.cutover_af']),
    cx_submitted: excelDateToISO(row.cx_submitted),
    cx_approved: excelDateToISO(row.cx_approved),
    mocn_activation_forecast: excelDateToISO(row.mocn_activation_forecast),
    rfs_forecast_lock: excelDateToISO(row.rfs_forecast_lock),
    caf_approved: excelDateToISO(row.caf_approved),
    mos_af: excelDateToISO(row.mos_af),
    ic_000040_af: excelDateToISO(row.ic_000040_af),
    fatp_accepted_af: excelDateToISO(row.fatp_accepted_af),
    cluster_acceptance_af: excelDateToISO(row.cluster_acceptance_af),
    cx_acceptance_status: stringOrNull(row.cx_acceptance_status),
    cx_remark: stringOrNull(row.cx_remark),
  }
}

export async function POST(request: Request) {
  try {
    const authError = requireApiKey(request, 'PMIS_5G_API_KEY')
    if (authError) return authError

    const fileResult = await readExcelUploadFile(request)
    if ('error' in fileResult) return fileResult.error

    const jsonData = parseExcelSkipFirstRow(fileResult.buffer, { cellDates: true })
    const filtered = jsonData.filter((row) => {
      const programReport = stringOrNull(row.program_report)
      return programReport !== EXCLUDED_PROGRAM_REPORT
    })

    const transformedData = filtered
      .map(map5gRow)
      .filter((row): row is Record<string, unknown> => row !== null)

    console.log(
      `[upload-5g] file=${fileResult.file.name} rows=${transformedData.length} (filtered from ${jsonData.length})`
    )

    const supabase = getServerSupabase()
    await upsertChunks(supabase, 'site_data_5g', transformedData)

    return NextResponse.json({
      success: true,
      message: 'Upload successful',
      totalRows: transformedData.length,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[upload-5g] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

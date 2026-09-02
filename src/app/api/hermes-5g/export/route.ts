import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { normalizeRanScoreForHermesFilter } from '@/lib/hermes-ran-score-filter'
import { SITE_DATA_5G_SELECT_COLUMNS, SITE_DATA_5G_HEADERS } from '@/lib/site-data-5g-columns'
import { computeHermesMatrixExportStats } from '@/lib/hermes-matrix-export-stats'
import { HERMES_DASHBOARD_NR_2600 } from '@/config/hermes-dashboards'
import type { HermesMilestoneFields } from '@/lib/hermes-milestone-fields'

const EXPORT_ROW_LIMIT = 50000

const VALID_TYPES = new Set(['activation'])

const MATRIX_EXPORT_MILESTONE_FIELDS: Record<string, HermesMilestoneFields | undefined> = {
  'nr-2600': HERMES_DASHBOARD_NR_2600.milestoneFields,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExportQuery = any

type SharedFilterOptions = {
  skipProgramReportFilters?: boolean
}

function applySharedFilters(
  query: ExportQuery,
  searchParams: URLSearchParams,
  options: SharedFilterOptions = {}
): ExportQuery {
  const vendorNames = searchParams.getAll('vendor_name')
  const impTtps = searchParams.getAll('imp_ttp')
  const nanoClusters = searchParams.getAll('nano_cluster')
  const regionCircles = searchParams.getAll('region_circle')
  const ranScores = searchParams.getAll('ran_score')
  const years = searchParams.getAll('year')
  const search = searchParams.get('q')

  if (!options.skipProgramReportFilters) {
    const programReports = searchParams.getAll('program_report')
    if (programReports.length > 0) {
      query = query.in('program_report', programReports)
    }

    const programReportContains = searchParams.get('program_report_contains')
    if (programReportContains?.trim()) {
      query = query.ilike('program_report', `%${programReportContains.trim()}%`)
    }
  }

  const wbsStatuses = searchParams.getAll('wbs_status').map((value) => value.trim()).filter(Boolean)
  if (wbsStatuses.length === 1) {
    query = query.ilike('wbs_status', wbsStatuses[0])
  } else if (wbsStatuses.length > 1) {
    query = query.or(wbsStatuses.map((value) => `wbs_status.ilike.${value}`).join(','))
  }

  if (vendorNames.length > 0) {
    query = query.in('vendor_name', vendorNames)
  }

  if (impTtps.length > 0) {
    query = query.in('imp_ttp', impTtps)
  }

  if (nanoClusters.length > 0) {
    query = query.in('nano_cluster', nanoClusters)
  }

  if (regionCircles.length > 0) {
    const normalizeCircle = (value: string): string =>
      value.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())

    const circleConditions = regionCircles
      .map((circle) => `region_circle.ilike.%${normalizeCircle(circle)}%`)
      .join(',')
    query = query.or(circleConditions)
  }

  if (years.length > 0) {
    query = query.in('year', years)
  }

  if (ranScores.length > 0) {
    const hasNewSite = ranScores.some((score) => score.trim() === 'New Site')
    const hasExpansion = ranScores.some((score) => score.trim() === 'Expansion')
    if (hasNewSite && !hasExpansion) {
      query = query.ilike('program_report', '%new%site%')
    } else if (hasExpansion && !hasNewSite) {
      query = query.or('program_report.is.null,program_report.not.ilike.%new%site%')
    }
  }

  if (search && search.trim().length > 0) {
    const like = `%${search.trim()}%`
    query = query.or(
      [
        `system_key.ilike.${like}`,
        `site_id.ilike.${like}`,
        `site_name.ilike.${like}`,
        `vendor_name.ilike.${like}`,
      ].join(',')
    )
  }

  return query
}

function buildFilterQuery(searchParams: URLSearchParams) {
  let query = supabase
    .from('site_data_5g')
    .select(SITE_DATA_5G_SELECT_COLUMNS.join(','))

  return applySharedFilters(query, searchParams)
}

function buildSupplementalFilterQuery(searchParams: URLSearchParams, programReport: string) {
  let query = supabase
    .from('site_data_5g')
    .select(SITE_DATA_5G_SELECT_COLUMNS.join(','))
    .eq('program_report', programReport)

  return applySharedFilters(query, searchParams, { skipProgramReportFilters: true })
}

function formatDateValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return value
  }

  const datePart = trimmed.split(/[T\s]/)[0]
  const [year, month, day] = datePart.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`
}

function normalizeExportRows(rows: Record<string, unknown>[]) {
  const headers = Array.from(SITE_DATA_5G_HEADERS)
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    headers.forEach((header) => {
      if (header === 'ran_score') {
        normalized[header] = normalizeRanScoreForHermesFilter(row.program_report as string | null | undefined)
      } else {
        normalized[header] = formatDateValue(row[header])
      }
    })
    return normalized
  })
}

function appendDataSheet(
  workbook: XLSX.WorkBook,
  rows: Record<string, unknown>[],
  sheetName: string
) {
  const headers = Array.from(SITE_DATA_5G_HEADERS)
  const normalizedRows = normalizeExportRows(rows)
  const worksheet =
    normalizedRows.length > 0
      ? XLSX.utils.json_to_sheet(normalizedRows, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers])

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
}

function appendMatrixSummarySheet(
  workbook: XLSX.WorkBook,
  mainRows: Record<string, unknown>[],
  supplementalRows: Record<string, unknown>[],
  milestoneFields?: HermesMilestoneFields
) {
  const stats = computeHermesMatrixExportStats(mainRows, supplementalRows, milestoneFields)
  const worksheet = XLSX.utils.json_to_sheet(
    stats.map((row) => ({
      Milestone: row.label,
      Count: row.count,
      Column: row.column,
      Scope: row.scope,
    })),
    { header: ['Milestone', 'Count', 'Column', 'Scope'] }
  )
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Matrix Summary')
}

function buildExportWorkbook(options: {
  mainRows: Record<string, unknown>[]
  supplementalRowsByProgram: Array<{ programReport: string; rows: Record<string, unknown>[] }>
  milestoneFields?: HermesMilestoneFields
  matrixExportId?: string
  type: string
}) {
  const workbook = XLSX.utils.book_new()
  const supplementalRows = options.supplementalRowsByProgram.flatMap((entry) => entry.rows)
  const mainSheetName =
    options.matrixExportId === 'nr-2600'
      ? 'NR 2600 (13k)'
      : options.type === 'activation'
        ? 'Activation'
        : 'On-Air'

  if (options.milestoneFields) {
    appendMatrixSummarySheet(workbook, options.mainRows, supplementalRows, options.milestoneFields)
  }

  appendDataSheet(workbook, options.mainRows, mainSheetName)

  for (const entry of options.supplementalRowsByProgram) {
    appendDataSheet(workbook, entry.rows, entry.programReport)
  }

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'activation').toLowerCase()

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid export type. Use "activation".' },
        { status: 400 }
      )
    }

    const supplementalProgramReports = searchParams
      .getAll('supplemental_program_report')
      .map((value) => value.trim())
      .filter(Boolean)
    const matrixExportId = searchParams.get('matrix_export') || ''
    const milestoneFields = MATRIX_EXPORT_MILESTONE_FIELDS[matrixExportId]

    let mainQuery = buildFilterQuery(searchParams).range(0, EXPORT_ROW_LIMIT - 1)
    const supplementalQueries = supplementalProgramReports.map((programReport) =>
      buildSupplementalFilterQuery(searchParams, programReport).range(0, EXPORT_ROW_LIMIT - 1)
    )

    const [mainResult, ...supplementalResults] = await Promise.all([
      mainQuery,
      ...supplementalQueries,
    ])

    if (mainResult.error) {
      console.error('[hermes-5g/export] Supabase error', mainResult.error)
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch data from Supabase.' },
        { status: 500 }
      )
    }

    for (const result of supplementalResults) {
      if (result.error) {
        console.error('[hermes-5g/export] Supabase supplemental error', result.error)
        return NextResponse.json(
          { status: 'error', message: 'Failed to fetch supplemental export data from Supabase.' },
          { status: 500 }
        )
      }
    }

    const mainRows = (mainResult.data || []) as unknown as Record<string, unknown>[]
    const supplementalRowsByProgram = supplementalProgramReports.map((programReport, index) => ({
      programReport,
      rows: (supplementalResults[index]?.data || []) as unknown as Record<string, unknown>[],
    }))

    const buffer = buildExportWorkbook({
      mainRows,
      supplementalRowsByProgram,
      milestoneFields,
      matrixExportId,
      type,
    })

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    const exportPrefix = matrixExportId || 'hermes-5g'
    const filename = `${exportPrefix}-${type}-export-${timestamp}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[hermes-5g/export] Unexpected error', err)
    return NextResponse.json(
      { status: 'error', message: 'Unexpected error while generating export.' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

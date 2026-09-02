import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { normalizeRanScoreForHermesFilter } from '@/lib/hermes-ran-score-filter'
import { SITE_DATA_5G_SELECT_COLUMNS, SITE_DATA_5G_HEADERS } from '@/lib/site-data-5g-columns'
import { computeHermesMatrixExportStats } from '@/lib/hermes-matrix-export-stats'
import { HERMES_DASHBOARD_NR_2600 } from '@/config/hermes-dashboards'
import type { HermesMilestoneFields } from '@/lib/hermes-milestone-fields'
import {
  applyHermesSharedFilters,
  parseHermesSharedFilterParams,
  type HermesFilterQuery,
} from '@/lib/hermes-shared-filters'

const EXPORT_ROW_LIMIT = 50000

const VALID_TYPES = new Set(['activation'])

const MATRIX_EXPORT_MILESTONE_FIELDS: Record<string, HermesMilestoneFields | undefined> = {
  'nr-2600': HERMES_DASHBOARD_NR_2600.milestoneFields,
}

function buildFilterQuery(searchParams: URLSearchParams) {
  const query = supabase
    .from('site_data_5g')
    .select(SITE_DATA_5G_SELECT_COLUMNS.join(',')) as unknown as HermesFilterQuery

  return applyHermesSharedFilters(query, parseHermesSharedFilterParams(searchParams))
}

function buildSupplementalFilterQuery(searchParams: URLSearchParams, programReport: string) {
  const query = supabase
    .from('site_data_5g')
    .select(SITE_DATA_5G_SELECT_COLUMNS.join(','))
    .eq('program_report', programReport) as unknown as HermesFilterQuery

  return applyHermesSharedFilters(
    query,
    parseHermesSharedFilterParams(searchParams),
    { skipProgramReportFilters: true }
  )
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

    const mainQuery = buildFilterQuery(searchParams).range(0, EXPORT_ROW_LIMIT - 1)
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

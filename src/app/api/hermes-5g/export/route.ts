import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { SITE_DATA_5G_SELECT_COLUMNS, SITE_DATA_5G_HEADERS } from '@/lib/site-data-5g-columns'

const EXPORT_ROW_LIMIT = 50000

const VALID_TYPES = new Set(['activation'])

type SupabaseQuery = ReturnType<typeof buildFilterQuery>

function buildFilterQuery(searchParams: URLSearchParams) {
  const vendorNames = searchParams.getAll('vendor_name')
  const programReports = searchParams.getAll('program_report')
  const impTtps = searchParams.getAll('imp_ttp')
  const nanoClusters = searchParams.getAll('nano_cluster')
  const search = searchParams.get('q')

  let query = supabase
    .from('site_data_5g')
    .select(SITE_DATA_5G_SELECT_COLUMNS.join(','))

  if (vendorNames.length > 0) {
    query = query.in('vendor_name', vendorNames)
  }

  if (programReports.length > 0) {
    query = query.in('program_report', programReports)
  }

  if (impTtps.length > 0) {
    query = query.in('imp_ttp', impTtps)
  }

  if (nanoClusters.length > 0) {
    query = query.in('nano_cluster', nanoClusters)
  }

  if (search && search.trim().length > 0) {
    const like = `%${search.trim()}%`
    query = query.or(
      [
        `system_key.ilike.${like}`,
        `site_id.ilike.${like}`,
        `site_name.ilike.${like}`,
        `vendor_name.ilike.${like}`
      ].join(',')
    )
  }

  return query
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

function applyMilestoneFilter(query: SupabaseQuery, type: string) {
  if (type === 'activation') {
    return query.or('site_status.ilike.%activation%,rfs_af.not.is.null,5g_activation_date.not.is.null')
  }

  if (type === 'on-air') {
    return query.or('site_status.ilike.%on air%,imp_integ_af.not.is.null,5g_readiness_date.not.is.null')
  }

  return query
}

function toWorkbookBuffer(rows: Record<string, unknown>[], sheetName: string) {
  const headers = Array.from(SITE_DATA_5G_HEADERS)
  const normalizedRows = rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    headers.forEach((header) => {
      const rawValue = row[header]
      normalized[header] = formatDateValue(rawValue)
    })
    return normalized
  })

  const worksheet = normalizedRows.length > 0
    ? XLSX.utils.json_to_sheet(normalizedRows, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers])

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'activation').toLowerCase()

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid export type. Use "activation" or "on-air".' },
        { status: 400 }
      )
    }

    let query = buildFilterQuery(searchParams)
    query = applyMilestoneFilter(query, type)
    query = query.range(0, EXPORT_ROW_LIMIT - 1)

    const { data, error } = await query

    if (error) {
      console.error('[hermes-5g/export] Supabase error', error)
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch data from Supabase.' },
        { status: 500 }
      )
    }

    const rows = (data || []) as unknown as Record<string, unknown>[]
    const buffer = toWorkbookBuffer(rows, type === 'activation' ? 'Activation' : 'On-Air')

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    const filename = `hermes-5g-${type}-export-${timestamp}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
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

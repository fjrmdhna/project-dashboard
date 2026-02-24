import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { SITE_DATA_AOP_SELECT_COLUMNS, SITE_DATA_AOP_HEADERS } from '@/lib/site-data-aop-columns'
import { normalizePriorityCongestUrgentValue } from '@/lib/supabase'

const EXPORT_ROW_LIMIT = 50000
const EXPORT_PAGE_SIZE = 1000

const VALID_TYPES = new Set(['aop'])

type SupabaseQuery = ReturnType<typeof buildFilterQuery>

function buildFilterQuery(searchParams: URLSearchParams) {
  const vendorNames = searchParams.getAll('vendor_name')
  const programReports = searchParams.getAll('program_report')
  const circles = searchParams.getAll('region_circle')
  const siteCategories = searchParams.getAll('site_category')
  const pmIndosat = searchParams.getAll('pm_indosat')
  const years = searchParams.getAll('year')
  const priorityCongestUrgent = searchParams.getAll('priority_congest_urgent')
  const trialGbFactory = searchParams.getAll('trial_gb_factory')
  const search = searchParams.get('q')

  let query = supabase
    .from('site_data_aop')
    .select(SITE_DATA_AOP_SELECT_COLUMNS.join(','))

  if (vendorNames.length > 0) {
    query = query.in('vendor_name', vendorNames)
  }

  if (programReports.length > 0) {
    query = query.in('program_report', programReports)
  }

  if (circles.length > 0) {
    const circleConditions = circles
      .map(c => {
        const normalized = c.trim().toLowerCase()
        return `region_circle.ilike.%${normalized}%`
      })
      .join(',')
    query = query.or(circleConditions)
  }

  if (siteCategories.length > 0) {
    const siteCategoryConditions = siteCategories
      .map(sc => {
        const lower = sc.toLowerCase()
        if (lower === 'new site') {
          return `site_category.ilike.%new%`
        } else if (lower === 'expansion') {
          return `site_category.ilike.%existing%,site_category.ilike.%upgrade%`
        }
        return `site_category.ilike.%${sc}%`
      })
      .join(',')
    query = query.or(siteCategoryConditions)
  }

  if (pmIndosat.length > 0) {
    query = query.in('pm_indosat', pmIndosat.map((p) => p.trim()).filter(Boolean))
  }

  // WBS Status: not applied here; applied after fetch with same trim+lower logic as UI (useAopData)

  if (years.length > 0) {
    query = query.in('year', years)
  }

  if (priorityCongestUrgent.length > 0) {
    // Normalize priority values and build query conditions
    // Handle "Prio Lebaran" and P1-P4 normalization
    const priorityConditions = priorityCongestUrgent
      .map(pcu => {
        const normalized = normalizePriorityCongestUrgentValue(pcu.trim())
        const lowerNormalized = normalized.toLowerCase()
        
        // If normalized to "Prio Lebaran", match all variations
        if (lowerNormalized === 'prio lebaran') {
          // Match any variation of "prio lebaran" (case-insensitive, handles multiple spaces)
          return `priority_congest_urgent.ilike.%prio%lebaran%`
        }
        
        // If normalized to P1, P2, P3, or P4, match all variations containing that priority
        if (lowerNormalized === 'p1' || lowerNormalized === 'p2' || lowerNormalized === 'p3' || lowerNormalized === 'p4') {
          // Match variations like: "P1", "Priority P1", "P1 - Urgent", etc.
          // Use pattern that matches the priority level (case-insensitive)
          return `priority_congest_urgent.ilike.%${normalized}%`
        }
        
        // For other values, use partial match (case-insensitive)
        return `priority_congest_urgent.ilike.%${normalized}%`
      })
      .join(',')
    query = query.or(priorityConditions)
  }

  // Trial GB Factory (pic_indosat): blank in DB = "Other" in dropdown
  if (trialGbFactory.length > 0) {
    const picIndosatConditions = trialGbFactory.map((v) => {
      const trimmed = v.trim()
      if (trimmed === 'Other') {
        return "pic_indosat.is.null,pic_indosat.eq.''"
      }
      return `pic_indosat.eq.${trimmed}`
    })
    query = query.or(picIndosatConditions.join(','))
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

function toWorkbookBuffer(rows: Record<string, unknown>[], sheetName: string) {
  const headers = Array.from(SITE_DATA_AOP_HEADERS)
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
    const type = (searchParams.get('type') || 'aop').toLowerCase()

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid export type. Use "aop".' },
        { status: 400 }
      )
    }

    const filterSnapshot = {
      vendorNames: searchParams.getAll('vendor_name'),
      programReports: searchParams.getAll('program_report'),
      circles: searchParams.getAll('region_circle'),
      siteCategories: searchParams.getAll('site_category'),
      pmIndosat: searchParams.getAll('pm_indosat'),
      years: searchParams.getAll('year'),
      priorityCongestUrgent: searchParams.getAll('priority_congest_urgent'),
      trialGbFactory: searchParams.getAll('trial_gb_factory'),
      wbsStatus: searchParams.getAll('wbs_status'),
      search: searchParams.get('q')
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '65284a'
      },
      body: JSON.stringify({
        sessionId: '65284a',
        runId: 'initial',
        hypothesisId: 'H1',
        location: 'src/app/api/aop/export/route.ts:GET:beforeQuery',
        message: 'AOP export API filters',
        data: filterSnapshot,
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion agent log

    const baseQuery = buildFilterQuery(searchParams)
    const allData: Record<string, unknown>[] = []
    let page = 0
    let hasMore = true

    while (hasMore && allData.length < EXPORT_ROW_LIMIT) {
      const from = page * EXPORT_PAGE_SIZE
      const to = Math.min(from + EXPORT_PAGE_SIZE - 1, EXPORT_ROW_LIMIT - 1)
      const { data: pageData, error } = await baseQuery.range(from, to)

      if (error) {
        console.error('[aop/export] Supabase error', error)
        return NextResponse.json(
          { status: 'error', message: 'Failed to fetch data from Supabase.' },
          { status: 500 }
        )
      }

      const chunk = (pageData || []) as unknown as Record<string, unknown>[]
      if (chunk.length === 0) break
      allData.push(...chunk)
      hasMore = chunk.length === EXPORT_PAGE_SIZE && allData.length < EXPORT_ROW_LIMIT
      page++
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '65284a'
      },
      body: JSON.stringify({
        sessionId: '65284a',
        runId: 'initial',
        hypothesisId: 'H1',
        location: 'src/app/api/aop/export/route.ts:GET:afterQuery',
        message: 'AOP export API result',
        data: { rowsLength: allData.length },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion agent log

    let rows = allData

    const totalBeforeFilter = rows.length

    // WBS Status: apply same trim + case-insensitive logic as UI (useAopData filterDataClientSide)
    const wbsStatusParam = searchParams.getAll('wbs_status').map((s) => s.trim()).filter(Boolean)
    if (wbsStatusParam.length > 0) {
      const wbsSet = new Set(wbsStatusParam.map((w) => w.toLowerCase()))
      rows = rows.filter((row) => {
        const raw = (row as Record<string, unknown>)['wbs_status']
        const rowWbs = (raw ?? '').toString().trim().toLowerCase()
        return rowWbs !== '' && wbsSet.has(rowWbs)
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '65284a'
        },
        body: JSON.stringify({
          sessionId: '65284a',
          runId: 'post-fix',
          hypothesisId: 'H2',
          location: 'src/app/api/aop/export/route.ts:GET:afterWbsFilter',
          message: 'AOP export WBS post-filter',
          data: {
            totalBeforeFilter,
            totalAfterFilter: rows.length,
            wbsStatusParam
          },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion agent log
    }

    const buffer = toWorkbookBuffer(rows, 'AOP')

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    const filename = `aop-export-${timestamp}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (err) {
    console.error('[aop/export] Unexpected error', err)
    return NextResponse.json(
      { status: 'error', message: 'Unexpected error while generating export.' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

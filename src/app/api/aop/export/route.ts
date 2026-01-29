import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { SITE_DATA_AOP_SELECT_COLUMNS, SITE_DATA_AOP_HEADERS } from '@/lib/site-data-aop-columns'
import { normalizeRanScoreValue, normalizePriorityCongestUrgentValue } from '@/lib/supabase'

const EXPORT_ROW_LIMIT = 50000

const VALID_TYPES = new Set(['aop'])

type SupabaseQuery = ReturnType<typeof buildFilterQuery>

function buildFilterQuery(searchParams: URLSearchParams) {
  const vendorNames = searchParams.getAll('vendor_name')
  const programReports = searchParams.getAll('program_report')
  const circles = searchParams.getAll('region_circle')
  const siteCategories = searchParams.getAll('site_category')
  const ranScores = searchParams.getAll('ran_score')
  const years = searchParams.getAll('year')
  const priorityCongestUrgent = searchParams.getAll('priority_congest_urgent')
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

  if (ranScores.length > 0) {
    // Normalize ran_score values and build query conditions
    // Handle "Co Expansion", "Co New Site", "New Site 2026", "New Site 2025", "Expansion 2026", and "Expansion 2025" normalization
    const ranScoreConditions = ranScores
      .map(rs => {
        const normalized = normalizeRanScoreValue(rs.trim())
        const lowerNormalized = normalized.toLowerCase()
        
        // If normalized to "Co New Site", match all variations containing "co" and "new site"
        if (lowerNormalized === 'co new site') {
          // Match variations like: "CO New Site", "Co New Site", "co-new-site", etc.
          return `ran_score.ilike.%co%new%site%`
        }
        
        // If normalized to "Co Expansion", match all variations containing "co" and "expansion" (with or without dash)
        if (lowerNormalized === 'co expansion') {
          // Match variations like: "CO Expansion", "Co Expansion", "Co - Expansion", "co-expansion", etc.
          return `ran_score.ilike.%co%expansion%`
        }
        
        // If normalized to "New Site 2026", match all variations containing "new site" and "2026" (without "co")
        if (lowerNormalized === 'new site 2026') {
          // Match variations like: "New Site 2026", "new site 2026", "New Site 2026 Aop", etc.
          // But exclude those with "co" (those should match "Co New Site" instead)
          return `ran_score.ilike.%new%site%2026%`
        }
        
        // If normalized to "New Site 2025", match all variations containing "new site" and "2025" (without "co")
        if (lowerNormalized === 'new site 2025') {
          // Match variations like: "New Site 2025", "new site 2025", "New Site 2025 Aop", etc.
          // But exclude those with "co" (those should match "Co New Site" instead)
          return `ran_score.ilike.%new%site%2025%`
        }
        
        // If normalized to "Expansion 2026", match all variations containing "expansion" and "2026" (without "co")
        if (lowerNormalized === 'expansion 2026') {
          // Match variations like: "Expansion 2026", "expansion 2026", etc.
          // But exclude those with "co" (those should match "Co Expansion" instead)
          return `ran_score.ilike.%expansion%2026%`
        }
        
        // If normalized to "Expansion 2025", match all variations containing "expansion" and "2025" (without "co")
        if (lowerNormalized === 'expansion 2025') {
          // Match variations like: "Expansion 2025", "expansion 2025", etc.
          // But exclude those with "co" (those should match "Co Expansion" instead)
          return `ran_score.ilike.%expansion%2025%`
        }
        
        // For other values, use exact match (case-insensitive)
        return `ran_score.ilike.${normalized}`
      })
      .join(',')
    query = query.or(ranScoreConditions)
  }

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

    let query = buildFilterQuery(searchParams)
    query = query.range(0, EXPORT_ROW_LIMIT - 1)

    const { data, error } = await query

    if (error) {
      console.error('[aop/export] Supabase error', error)
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch data from Supabase.' },
        { status: 500 }
      )
    }

    const rows = (data || []) as unknown as Record<string, unknown>[]
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

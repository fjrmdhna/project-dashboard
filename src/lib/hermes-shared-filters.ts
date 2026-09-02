import { applyRanScoreFilterByProgramReport } from '@/lib/hermes-ran-score-filter'

/** Search fields shared by dashboard client filter and Excel export API. */
export const HERMES_DASHBOARD_SEARCH_FIELDS = [
  'system_key',
  'site_id',
  'site_name',
  'vendor_name',
  'program_report',
] as const

export type HermesSearchableRow = {
  system_key?: string | null
  site_id?: string | null
  site_name?: string | null
  vendor_name?: string | null
  program_report?: string | null
}

export function normalizeHermesCircle(value: string): string {
  return value.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

export function matchesHermesCircleFilter(
  rowCircle: string | null | undefined,
  filterCircles: string[]
): boolean {
  if (filterCircles.length === 0) return true
  const normalizedRowCircle = normalizeHermesCircle(rowCircle || '')
  const normalizedFilterCircles = filterCircles.map(normalizeHermesCircle)
  return normalizedFilterCircles.some(
    (circle) => normalizedRowCircle === circle || normalizedRowCircle.includes(circle)
  )
}

export function matchesHermesDashboardSearch(
  row: HermesSearchableRow,
  search: string
): boolean {
  const trimmed = search.trim()
  if (!trimmed) return true

  const searchLower = trimmed.toLowerCase()
  const searchFields = HERMES_DASHBOARD_SEARCH_FIELDS.map((field) => row[field])
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  return searchFields.some((field) => field.includes(searchLower))
}

export function buildHermesSearchOrFilter(search: string): string {
  const like = `%${search.trim()}%`
  return HERMES_DASHBOARD_SEARCH_FIELDS.map((field) => `${field}.ilike.${like}`).join(',')
}

export type HermesFilterQuery = {
  in: (column: string, values: string[]) => HermesFilterQuery
  ilike: (column: string, pattern: string) => HermesFilterQuery
  or: (conditions: string) => HermesFilterQuery
  eq: (column: string, value: string) => HermesFilterQuery
  range: (
    from: number,
    to: number
  ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
}

export type HermesSharedFilterOptions = {
  skipProgramReportFilters?: boolean
}

export function applyHermesSharedFilters(
  query: HermesFilterQuery,
  params: {
    vendorNames?: string[]
    impTtps?: string[]
    nanoClusters?: string[]
    regionCircles?: string[]
    ranScores?: string[]
    years?: string[]
    search?: string | null
    programReports?: string[]
    programReportContains?: string | null
    wbsStatuses?: string[]
  },
  options: HermesSharedFilterOptions = {}
): HermesFilterQuery {
  let nextQuery: HermesFilterQuery = query

  if (!options.skipProgramReportFilters) {
    if (params.programReports && params.programReports.length > 0) {
      nextQuery = nextQuery.in('program_report', params.programReports)
    }

    const programReportContains = params.programReportContains?.trim()
    if (programReportContains) {
      nextQuery = nextQuery.ilike('program_report', `%${programReportContains}%`)
    }
  }

  const wbsStatuses = (params.wbsStatuses ?? []).map((value) => value.trim()).filter(Boolean)
  if (wbsStatuses.length === 1) {
    nextQuery = nextQuery.ilike('wbs_status', wbsStatuses[0])
  } else if (wbsStatuses.length > 1) {
    nextQuery = nextQuery.or(wbsStatuses.map((value) => `wbs_status.ilike.${value}`).join(','))
  }

  if (params.vendorNames && params.vendorNames.length > 0) {
    nextQuery = nextQuery.in('vendor_name', params.vendorNames)
  }

  if (params.impTtps && params.impTtps.length > 0) {
    nextQuery = nextQuery.in('imp_ttp', params.impTtps)
  }

  if (params.nanoClusters && params.nanoClusters.length > 0) {
    nextQuery = nextQuery.in('nano_cluster', params.nanoClusters)
  }

  if (params.regionCircles && params.regionCircles.length > 0) {
    const circleConditions = params.regionCircles
      .map((circle) => `region_circle.ilike.%${normalizeHermesCircle(circle)}%`)
      .join(',')
    nextQuery = nextQuery.or(circleConditions)
  }

  if (params.years && params.years.length > 0) {
    nextQuery = nextQuery.in('year', params.years)
  }

  nextQuery = applyRanScoreFilterByProgramReport(nextQuery, params.ranScores)

  const search = params.search?.trim()
  if (search) {
    nextQuery = nextQuery.or(buildHermesSearchOrFilter(search))
  }

  return nextQuery
}

export function parseHermesSharedFilterParams(searchParams: URLSearchParams) {
  return {
    vendorNames: searchParams.getAll('vendor_name'),
    impTtps: searchParams.getAll('imp_ttp'),
    nanoClusters: searchParams.getAll('nano_cluster'),
    regionCircles: searchParams.getAll('region_circle'),
    ranScores: searchParams.getAll('ran_score'),
    years: searchParams.getAll('year'),
    search: searchParams.get('q'),
    programReports: searchParams.getAll('program_report'),
    programReportContains: searchParams.get('program_report_contains'),
    wbsStatuses: searchParams.getAll('wbs_status'),
  }
}

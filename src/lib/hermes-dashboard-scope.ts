import type { ProjectProgressFilters } from "@/lib/project-progress"
import type { SiteData5GFilters } from "@/lib/supabase"

/** Mandatory WBS status for Hermes / NR 2600 dashboards (case-insensitive match) */
export const HERMES_DASHBOARD_ACTIVE_WBS_STATUS = "Active"

/** Mandatory data scope for Hermes dashboards (program_report + wbs_status) */
export type HermesDashboardDataScope = Pick<
  ProjectProgressFilters,
  "program_report" | "program_report_match"
> & {
  wbs_status?: string | string[]
}

function normalizeScopeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function getScopeWbsStatuses(scope?: HermesDashboardDataScope): string[] {
  if (!scope?.wbs_status) return []
  return (Array.isArray(scope.wbs_status) ? scope.wbs_status : [scope.wbs_status])
    .map((value) => String(value).trim())
    .filter(Boolean)
}

/** Convert dashboard scope to Supabase site-data filters */
export function dataScopeToSiteDataFilters(
  scope?: HermesDashboardDataScope
): SiteData5GFilters {
  if (!scope) return {}

  const filters: SiteData5GFilters = {}

  if (scope.program_report) {
    const needle = Array.isArray(scope.program_report)
      ? scope.program_report[0]
      : scope.program_report

    if (needle) {
      filters.program_report = [needle]
      if (scope.program_report_match === "contains") {
        filters.program_report_match = "contains"
      }
    }
  }

  const wbsStatuses = getScopeWbsStatuses(scope)
  if (wbsStatuses.length > 0) {
    filters.wbs_status = wbsStatuses.length === 1 ? wbsStatuses[0] : wbsStatuses
  }

  return filters
}

export function matchesProgramReportScope(
  programReport: string | null | undefined,
  scope: HermesDashboardDataScope
): boolean {
  const needleRaw = scope.program_report
  if (!needleRaw) return true

  const needles = Array.isArray(needleRaw) ? needleRaw : [needleRaw]
  const haystack = (programReport ?? "").toLowerCase()

  if (scope.program_report_match === "contains") {
    return needles.some((needle) => haystack.includes(String(needle).toLowerCase()))
  }

  return needles.some((needle) => programReport === needle)
}

export function matchesWbsStatusScope(
  wbsStatus: string | null | undefined,
  scope?: HermesDashboardDataScope
): boolean {
  const needles = getScopeWbsStatuses(scope)
  if (needles.length === 0) return true

  const haystack = normalizeScopeValue(wbsStatus)
  if (!haystack) return false

  return needles.some((needle) => haystack === normalizeScopeValue(needle))
}

export function filterRowsByDataScope<
  T extends { program_report?: string | null; wbs_status?: string | null }
>(rows: T[], scope?: HermesDashboardDataScope): T[] {
  if (!scope?.program_report && !scope?.wbs_status) return rows

  return rows.filter(
    (row) =>
      matchesProgramReportScope(row.program_report, scope) &&
      matchesWbsStatusScope(row.wbs_status, scope)
  )
}

/** @deprecated Use filterRowsByDataScope */
export function filterRowsByProgramReportScope<
  T extends { program_report?: string | null; wbs_status?: string | null }
>(rows: T[], scope?: HermesDashboardDataScope): T[] {
  return filterRowsByDataScope(rows, scope)
}

/** Stable cache key segment for scoped filter options (API + in-memory) */
export function getDataScopeCacheKey(scope?: HermesDashboardDataScope): string {
  const parts: string[] = []

  if (scope?.program_report) {
    const needle = Array.isArray(scope.program_report)
      ? scope.program_report.join(",")
      : scope.program_report
    const match = scope.program_report_match ?? "eq"
    parts.push(`pr:${match}:${needle}`)
  }

  const wbsStatuses = getScopeWbsStatuses(scope)
  if (wbsStatuses.length > 0) {
    parts.push(`wbs:${wbsStatuses.map((value) => normalizeScopeValue(value)).join(",")}`)
  }

  return parts.length > 0 ? parts.join("|") : "all"
}

export function appendDataScopeToSearchParams(
  params: URLSearchParams,
  scope?: HermesDashboardDataScope
): URLSearchParams {
  if (scope?.program_report) {
    const programReport = Array.isArray(scope.program_report)
      ? scope.program_report[0]
      : scope.program_report
    params.set("program_report", programReport)
    if (scope.program_report_match) {
      params.set("program_report_match", scope.program_report_match)
    }
  }

  const wbsStatuses = getScopeWbsStatuses(scope)
  wbsStatuses.forEach((value) => params.append("wbs_status", value))

  return params
}

export function parseDataScopeFromSearchParams(
  searchParams: URLSearchParams
): HermesDashboardDataScope | undefined {
  const programReport = searchParams.get("program_report")
  const wbsStatus = searchParams.getAll("wbs_status").map((value) => value.trim()).filter(Boolean)

  if (!programReport && wbsStatus.length === 0) return undefined

  const match = searchParams.get("program_report_match")

  return {
    ...(programReport
      ? {
          program_report: programReport,
          ...(match === "contains" ? { program_report_match: "contains" as const } : {}),
        }
      : {}),
    ...(wbsStatus.length > 0
      ? { wbs_status: wbsStatus.length === 1 ? wbsStatus[0] : wbsStatus }
      : {}),
  }
}

type ScopedSupabaseQuery = {
  ilike: (column: string, pattern: string) => unknown
  eq: (column: string, value: string) => unknown
  in: (column: string, values: string[]) => unknown
}

/** Apply mandatory dashboard scope to Supabase queries */
export function applyDashboardScopeToQuery<T>(
  query: T,
  scope?: HermesDashboardDataScope
): T {
  let scopedQuery = applyProgramReportScopeToQuery(query as ScopedSupabaseQuery, scope) as T
  scopedQuery = applyWbsStatusScopeToQuery(scopedQuery as ScopedSupabaseQuery, scope) as T
  return scopedQuery
}

/** Apply mandatory program_report scope to Supabase filter-option queries */
export function applyProgramReportScopeToQuery<T>(
  query: T,
  scope?: HermesDashboardDataScope
): T {
  if (!scope?.program_report) return query

  const needle = Array.isArray(scope.program_report)
    ? scope.program_report[0]
    : scope.program_report

  if (!needle) return query

  const q = query as ScopedSupabaseQuery

  if (scope.program_report_match === "contains") {
    return q.ilike("program_report", `%${needle}%`) as T
  }

  if (Array.isArray(scope.program_report)) {
    return q.in("program_report", scope.program_report) as T
  }

  return q.eq("program_report", needle) as T
}

/** Apply mandatory wbs_status scope (case-insensitive exact match via ILIKE) */
export function applyWbsStatusScopeToQuery<T>(
  query: T,
  scope?: HermesDashboardDataScope
): T {
  const wbsStatuses = getScopeWbsStatuses(scope)
  if (wbsStatuses.length === 0) return query

  const q = query as ScopedSupabaseQuery

  if (wbsStatuses.length === 1) {
    return q.ilike("wbs_status", wbsStatuses[0]) as T
  }

  const orClause = wbsStatuses
    .map((value) => `wbs_status.ilike.${value}`)
    .join(",")

  return (q as unknown as { or: (clause: string) => T }).or(orClause)
}

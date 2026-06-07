import type { ProjectProgressFilters } from "@/lib/project-progress"

/** Mandatory program_report scope for scoped dashboards (e.g. NR 2600 → 13K programs only) */
export type HermesDashboardDataScope = Pick<
  ProjectProgressFilters,
  "program_report" | "program_report_match"
>

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

export function filterRowsByProgramReportScope<T extends { program_report?: string | null }>(
  rows: T[],
  scope?: HermesDashboardDataScope
): T[] {
  if (!scope?.program_report) return rows
  return rows.filter((row) => matchesProgramReportScope(row.program_report, scope))
}

/** Stable cache key segment for scoped filter options (API + in-memory) */
export function getDataScopeCacheKey(scope?: HermesDashboardDataScope): string {
  if (!scope?.program_report) return "all"
  const needle = Array.isArray(scope.program_report)
    ? scope.program_report.join(",")
    : scope.program_report
  const match = scope.program_report_match ?? "eq"
  return `${match}:${needle}`
}

export function parseDataScopeFromSearchParams(
  searchParams: URLSearchParams
): HermesDashboardDataScope | undefined {
  const programReport = searchParams.get("program_report")
  if (!programReport) return undefined

  const match = searchParams.get("program_report_match")
  return {
    program_report: programReport,
    ...(match === "contains" ? { program_report_match: "contains" as const } : {}),
  }
}

/** Apply mandatory program_report scope to Supabase filter-option queries */
export function applyProgramReportScopeToQuery(
  query: {
    ilike: (column: string, pattern: string) => unknown
    eq: (column: string, value: string) => unknown
    in: (column: string, values: string[]) => unknown
  },
  scope?: HermesDashboardDataScope
) {
  if (!scope?.program_report) return query

  const needle = Array.isArray(scope.program_report)
    ? scope.program_report[0]
    : scope.program_report

  if (scope.program_report_match === "contains") {
    return query.ilike("program_report", `%${needle}%`)
  }

  if (Array.isArray(scope.program_report)) {
    return query.in("program_report", scope.program_report)
  }

  return query.eq("program_report", needle)
}

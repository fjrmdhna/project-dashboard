import type { ProjectProgressFilters } from "@/lib/project-progress"
import type { FilterValue } from "@/components/filters/FilterBar"
import type { HermesDashboardDataScope } from "@/lib/hermes-dashboard-scope"
import type { HermesMilestoneFields } from "@/lib/hermes-milestone-fields"
import { NR_2600_MILESTONE_FIELDS } from "@/lib/hermes-milestone-fields"
import type { HermesProgressCurveFields } from "@/lib/hermes-progress-curve-fields"
import { NR_2600_PROGRESS_CURVE_FIELDS } from "@/lib/hermes-progress-curve-fields"

/** NR 2600: only sites whose program_report contains "13k" (e.g. "5G 13K - Cov") */
export const NR_2600_PROGRAM_REPORT_SCOPE: HermesDashboardDataScope = {
  program_report: "13k",
  program_report_match: "contains",
}

export interface HermesDashboardConfig {
  id: string
  /** Short label shown in loading screen, e.g. "Hermes 5G" */
  label: string
  /** Main dashboard header title */
  dashboardTitle: string
  /** Map page header title */
  mapTitle: string
  /** Route prefix, e.g. "/hermes-5g" */
  basePath: string
  /** localStorage key for filter persistence (must be unique per dashboard) */
  filterStorageKey: string
  /** Excel export filename prefix */
  exportPrefix: string
  /** Client-side map data cache key */
  mapCacheKey: string
  /** Optional filters for home-page progress card */
  progressFilter?: ProjectProgressFilters
  /** Mandatory data scope — always applied, not exposed in FilterBar */
  dataScope?: HermesDashboardDataScope
  /** NR-specific milestone columns/labels for matrix + readiness/activated cards */
  milestoneFields?: HermesMilestoneFields
  /** Progress curve series columns/labels (e.g. NR 2600 four-line curve) */
  progressCurveFields?: HermesProgressCurveFields
  /** Filter fields to hide from FilterBar (e.g. NR 2600 has no program_report filter) */
  hiddenFilters?: ReadonlyArray<keyof FilterValue>
}

/** Build filter-options API URL; scoped dashboards append program_report query params */
export function getHermesFilterOptionsEndpoint(config: HermesDashboardConfig): string {
  if (!config.dataScope?.program_report) return "/api/filters"

  const params = new URLSearchParams()
  const programReport = config.dataScope.program_report
  params.set(
    "program_report",
    Array.isArray(programReport) ? programReport[0] : programReport
  )
  if (config.dataScope.program_report_match) {
    params.set("program_report_match", config.dataScope.program_report_match)
  }
  return `/api/filters?${params.toString()}`
}

/** Build site-data API URL; scoped dashboards fetch only their program_report slice server-side */
export function getHermesSiteDataEndpoint(
  scope?: HermesDashboardDataScope,
  mode: "minimal" | "full" = "minimal"
): string {
  const params = new URLSearchParams({ mode })

  if (scope?.program_report) {
    const programReport = scope.program_report
    params.set(
      "program_report",
      Array.isArray(programReport) ? programReport[0] : programReport
    )
    if (scope.program_report_match) {
      params.set("program_report_match", scope.program_report_match)
    }
  }

  return `/api/hermes-5g/site-data?${params.toString()}`
}

/** Build map-data API URL with dashboard scope + milestone columns */
export function getHermesMapDataEndpoint(config: HermesDashboardConfig): string {
  const params = new URLSearchParams()

  if (config.dataScope?.program_report) {
    const programReport = config.dataScope.program_report
    params.set(
      "program_report",
      Array.isArray(programReport) ? programReport[0] : programReport
    )
    if (config.dataScope.program_report_match) {
      params.set("program_report_match", config.dataScope.program_report_match)
    }
  }

  if (config.milestoneFields) {
    params.set("readiness_column", config.milestoneFields.readinessColumn)
    params.set("activated_column", config.milestoneFields.activatedColumn)
  }

  const qs = params.toString()
  return qs ? `/api/hermes-5g/map-data?${qs}` : "/api/hermes-5g/map-data"
}

export const HERMES_DASHBOARD_HERMES_5G: HermesDashboardConfig = {
  id: "hermes-5g",
  label: "Hermes 5G",
  dashboardTitle: "Dashboard Hermes",
  mapTitle: "Hermes 5G Progress Map",
  basePath: "/hermes-5g",
  filterStorageKey: "hermes-filter-state",
  exportPrefix: "hermes-5g",
  mapCacheKey: "hermes-map-all-v2",
}

export const HERMES_DASHBOARD_NR_2600: HermesDashboardConfig = {
  id: "nr-2600",
  label: "NR 2600",
  dashboardTitle: "Dashboard NR 2600",
  mapTitle: "NR 2600 Progress Map",
  basePath: "/nr-2600",
  filterStorageKey: "nr-2600-filter-state",
  exportPrefix: "nr-2600",
  mapCacheKey: "nr-2600-map-all-v2",
  dataScope: NR_2600_PROGRAM_REPORT_SCOPE,
  progressFilter: NR_2600_PROGRAM_REPORT_SCOPE,
  milestoneFields: NR_2600_MILESTONE_FIELDS,
  progressCurveFields: NR_2600_PROGRESS_CURVE_FIELDS,
  hiddenFilters: ["program_report"],
}

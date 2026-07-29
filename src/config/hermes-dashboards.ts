import type { ProjectProgressFilters } from "@/lib/project-progress"
import type { FilterValue } from "@/components/filters/FilterBar"
import {
  HERMES_DASHBOARD_ACTIVE_WBS_STATUS,
  type HermesDashboardDataScope,
  appendDataScopeToSearchParams,
} from "@/lib/hermes-dashboard-scope"
import type { HermesCityMilestoneCardConfig, HermesMilestoneFields } from "@/lib/hermes-milestone-fields"
import { NR_2600_MILESTONE_FIELDS, NR_2600_MOS_BY_CITY_CARD } from "@/lib/hermes-milestone-fields"
import type {
  HermesDailyRunrateMilestone,
  HermesProgressCurveFields,
} from "@/lib/hermes-progress-curve-fields"
import { NR_2600_PROGRESS_CURVE_FIELDS } from "@/lib/hermes-progress-curve-fields"

/** Hermes 5G: program_report contains "10k" and wbs_status is Active */
export const HERMES_5G_PROGRAM_REPORT_SCOPE: HermesDashboardDataScope = {
  program_report: "10k",
  program_report_match: "contains",
  wbs_status: HERMES_DASHBOARD_ACTIVE_WBS_STATUS,
}

/** NR 2600: program_report contains "13k" and wbs_status is Active */
export const NR_2600_PROGRAM_REPORT_SCOPE: HermesDashboardDataScope = {
  program_report: "13k",
  program_report_match: "contains",
  wbs_status: HERMES_DASHBOARD_ACTIVE_WBS_STATUS,
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
  /** Filter fields to hide from FilterBar (e.g. Hermes 5G hides program_report) */
  hiddenFilters?: ReadonlyArray<keyof FilterValue>
  /** Daily runrate milestone pair — default activated (Hermes), NR 2600 uses readiness */
  dailyRunrateMilestone?: HermesDailyRunrateMilestone
  /** Optional card header override for daily runrate */
  dailyRunrateTitle?: string
  /** Top-left city bar chart (e.g. NR 2600 MOS by City) */
  cityMilestoneCard?: HermesCityMilestoneCardConfig
  /** When true, hide activation-by-city and show readiness in the lower left slot */
  hideActivatedCityCard?: boolean
}

/** Build filter-options API URL; scoped dashboards append scope query params */
export function getHermesFilterOptionsEndpoint(config: HermesDashboardConfig): string {
  if (!config.dataScope) return "/api/filters"

  const params = appendDataScopeToSearchParams(new URLSearchParams(), config.dataScope)
  const qs = params.toString()
  return qs ? `/api/filters?${qs}` : "/api/filters"
}

/** Build map-data API URL with dashboard scope + milestone columns */
export function getHermesMapDataEndpoint(config: HermesDashboardConfig): string {
  const params = appendDataScopeToSearchParams(new URLSearchParams(), config.dataScope)

  if (config.milestoneFields) {
    params.set("readiness_column", config.milestoneFields.readinessColumn)
    params.set("activated_column", config.milestoneFields.activatedColumn)
  }

  const qs = params.toString()
  return qs ? `/api/hermes-5g/map-data?${qs}` : "/api/hermes-5g/map-data"
}

/** Build site-data API URL with optional dashboard scope (smaller payload for scoped dashboards) */
export function getHermesSiteDataEndpoint(
  dataScope?: HermesDashboardDataScope,
  mode: "minimal" | "full" = "minimal"
): string {
  const params = appendDataScopeToSearchParams(new URLSearchParams({ mode }), dataScope)
  return `/api/hermes-5g/site-data?${params.toString()}`
}

export const HERMES_DASHBOARD_HERMES_5G: HermesDashboardConfig = {
  id: "hermes-5g",
  label: "Hermes 5G",
  dashboardTitle: "Dashboard Hermes",
  mapTitle: "Hermes 5G Progress Map",
  basePath: "/hermes-5g",
  filterStorageKey: "hermes-filter-state",
  exportPrefix: "hermes-5g",
  mapCacheKey: "hermes-map-10k-active-v1",
  dataScope: HERMES_5G_PROGRAM_REPORT_SCOPE,
  progressFilter: HERMES_5G_PROGRAM_REPORT_SCOPE,
  hiddenFilters: ["program_report"],
}

export const HERMES_DASHBOARD_NR_2600: HermesDashboardConfig = {
  id: "nr-2600",
  label: "NR 2600",
  dashboardTitle: "Dashboard NR 2600",
  mapTitle: "NR 2600 Progress Map",
  basePath: "/nr-2600",
  filterStorageKey: "nr-2600-filter-state",
  exportPrefix: "nr-2600",
  mapCacheKey: "nr-2600-map-13k-active-v1",
  dataScope: NR_2600_PROGRAM_REPORT_SCOPE,
  progressFilter: NR_2600_PROGRAM_REPORT_SCOPE,
  milestoneFields: NR_2600_MILESTONE_FIELDS,
  progressCurveFields: NR_2600_PROGRESS_CURVE_FIELDS,
  dailyRunrateMilestone: "readiness",
  dailyRunrateTitle: "Daily Readiness Runrate – Last 7 Days",
  cityMilestoneCard: NR_2600_MOS_BY_CITY_CARD,
  hideActivatedCityCard: true,
}

import type { ProjectProgressFilters } from "@/lib/project-progress"

/**
 * Config-driven AOP family dashboards (same pattern as hermes-dashboards).
 * Sister clones add a new entry + thin route wrappers — no page monolith copy.
 */
export interface AopDashboardConfig {
  id: string
  /** Short label for loading screens, e.g. "AOP" */
  label: string
  /** Overview header title */
  dashboardTitle: string
  /** Map page header title */
  mapTitle: string
  /** Route prefix, e.g. "/aop" */
  basePath: string
  /** API route prefix, e.g. "/api/aop" */
  apiBasePath: string
  /** FilterBar variant (shared AOP filter UI) */
  filterVariant: "aop"
  /** Excel export filename prefix */
  exportPrefix: string
  /** Supabase table used by home progress card */
  progressTable: string
  /** Optional progress filters for home card */
  progressFilter?: ProjectProgressFilters
}

export function getAopFiltersEndpoint(config: AopDashboardConfig): string {
  return `${config.apiBasePath}/filters`
}

export function getAopSiteDataEndpoint(config: AopDashboardConfig): string {
  return `${config.apiBasePath}/site-data`
}

export function getAopMapDataEndpoint(config: AopDashboardConfig): string {
  return `${config.apiBasePath}/map-data`
}

export function getAopExportEndpoint(config: AopDashboardConfig): string {
  return `${config.apiBasePath}/export`
}

export function getAopTemplatesEndpoint(config: AopDashboardConfig): string {
  return `${config.apiBasePath}/templates`
}

export function getAopTemplateByIdEndpoint(config: AopDashboardConfig, id: string): string {
  return `${config.apiBasePath}/templates/${id}`
}

export const AOP_DASHBOARD_DEFAULT: AopDashboardConfig = {
  id: "aop",
  label: "AOP",
  dashboardTitle: "Dashboard AOP",
  mapTitle: "AOP Progress Map",
  basePath: "/aop",
  apiBasePath: "/api/aop",
  filterVariant: "aop",
  exportPrefix: "aop",
  progressTable: "site_data_aop",
}

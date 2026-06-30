import { getRowWoDerivedYear } from "@/lib/tlp-wo-number-year"
import { isTlpScopedProgramGroup } from "@/lib/tlp-program-site-category"

export type TlpSiteFilters = {
  /** Full calendar years derived from wo_number_1 suffix (e.g. 2025). */
  year?: number[]
  program_group?: string[]
  project_name?: string[]
  site_category?: string[]
  twr_owner?: string[]
}

export type TlpFilterableRow = {
  wo_number_1?: string | null
  year_from_wo?: number | null
  region_circle?: string | null
  program_group?: string | null
  project_name?: string | null
  wbs_status?: string | null
  site_category?: string | null
  twr_owner?: string | null
}

function isNonEmptyString(v: unknown): v is string {
  return v !== null && v !== undefined && String(v).trim() !== ""
}

function normalizeString(v: unknown): string {
  return isNonEmptyString(v) ? String(v).trim().toLowerCase() : ""
}

export function tlpFiltersToQueryString(filters: TlpSiteFilters): string {
  const sp = new URLSearchParams()

  if (Array.isArray(filters.year) && filters.year.length > 0) {
    for (const y of [...filters.year].sort((a, b) => a - b)) {
      if (typeof y === "number" && !Number.isNaN(y)) sp.append("year", String(y))
    }
  }
  if (Array.isArray(filters.program_group) && filters.program_group.length > 0) {
    for (const v of [...filters.program_group].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("program_group", v)
    }
  }
  if (Array.isArray(filters.project_name) && filters.project_name.length > 0) {
    for (const v of [...filters.project_name].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("project_name", v)
    }
  }
  if (Array.isArray(filters.site_category) && filters.site_category.length > 0) {
    for (const v of [...filters.site_category].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("site_category", v)
    }
  }
  if (Array.isArray(filters.twr_owner) && filters.twr_owner.length > 0) {
    for (const v of [...filters.twr_owner].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("twr_owner", v)
    }
  }

  const qs = sp.toString()
  return qs ? qs : ""
}

export function tlpFiltersCacheKeySuffix(filters: TlpSiteFilters): string {
  const entries: Array<[string, string]> = []

  if (Array.isArray(filters.year) && filters.year.length > 0) {
    entries.push(["year", [...filters.year].sort((a, b) => a - b).join(",")])
  }
  if (Array.isArray(filters.program_group) && filters.program_group.length > 0) {
    entries.push(["program_group", [...filters.program_group].sort((a, b) => a.localeCompare(b)).join(",")])
  }
  if (Array.isArray(filters.project_name) && filters.project_name.length > 0) {
    entries.push(["project_name", [...filters.project_name].sort((a, b) => a.localeCompare(b)).join(",")])
  }
  if (Array.isArray(filters.site_category) && filters.site_category.length > 0) {
    entries.push(["site_category", [...filters.site_category].sort((a, b) => a.localeCompare(b)).join(",")])
  }
  if (Array.isArray(filters.twr_owner) && filters.twr_owner.length > 0) {
    entries.push(["twr_owner", [...filters.twr_owner].sort((a, b) => a.localeCompare(b)).join(",")])
  }

  entries.sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${k}=${v}`).join("&")
}

export function parseTlpFiltersFromSearchParams(searchParams: URLSearchParams): TlpSiteFilters {
  const yearsRaw = searchParams.getAll("year")
  const year = yearsRaw
    .map((y) => Number(y))
    .filter((n) => !Number.isNaN(n))

  const program_group = searchParams.getAll("program_group")
  const project_name = searchParams.getAll("project_name")
  const site_category = searchParams.getAll("site_category")
  const twr_owner = searchParams.getAll("twr_owner")

  return {
    year: year.length > 0 ? year : undefined,
    program_group: program_group.length > 0 ? program_group : undefined,
    project_name: project_name.length > 0 ? project_name : undefined,
    site_category: site_category.length > 0 ? site_category : undefined,
    twr_owner: twr_owner.length > 0 ? twr_owner : undefined,
  }
}

export function rowMatchesTlpFilters(row: TlpFilterableRow, filters: TlpSiteFilters): boolean {
  if (!isTlpScopedProgramGroup(row.program_group)) return false

  if (Array.isArray(filters.year) && filters.year.length > 0) {
    const yearSet = new Set(filters.year)
    const rowYear = getRowWoDerivedYear(row)
    if (rowYear === null || !yearSet.has(rowYear)) return false
  }

  if (Array.isArray(filters.program_group) && filters.program_group.length > 0) {
    const rowVal = normalizeString(row.program_group)
    const set = new Set(filters.program_group.map((v) => normalizeString(v)))
    if (!set.has(rowVal)) return false
  }

  if (Array.isArray(filters.project_name) && filters.project_name.length > 0) {
    const rowVal = normalizeString(row.project_name)
    const set = new Set(filters.project_name.map((v) => normalizeString(v)))
    if (!set.has(rowVal)) return false
  }

  if (Array.isArray(filters.site_category) && filters.site_category.length > 0) {
    const rowVal = normalizeString(row.site_category)
    const set = new Set(filters.site_category.map((v) => normalizeString(v)))
    if (!set.has(rowVal)) return false
  }

  if (Array.isArray(filters.twr_owner) && filters.twr_owner.length > 0) {
    const rowVal = normalizeString(row.twr_owner)
    const set = new Set(filters.twr_owner.map((v) => normalizeString(v)))
    if (!set.has(rowVal)) return false
  }

  return true
}

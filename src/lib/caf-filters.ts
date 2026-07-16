export type CafSiteFilters = {
  q?: string
  project_name?: string[]
  vendor_tlp_name?: string[]
  vendor_requestor_name?: string[]
  caf_status?: string[]
  caf_type?: string[]
  avp?: string[]
  /** Calendar year from `rfs_af` (RFS actual finish). */
  year?: string[]
}

/** Distinct dropdown values for CAF Monitoring filter bar. */
export type CafFilterOptions = {
  projects: string[]
  vendorTlp: string[]
  vendorRequestor: string[]
  cafStatus: string[]
  cafType: string[]
  avp: string[]
  year: string[]
}

export const EMPTY_CAF_FILTER_OPTIONS: CafFilterOptions = {
  projects: [],
  vendorTlp: [],
  vendorRequestor: [],
  cafStatus: [],
  cafType: [],
  avp: [],
  year: [],
}

/**
 * Year pre-selected on first landing (RFS AF calendar year).
 * Reset clears filters entirely — it does not restore this selection.
 */
export const CAF_LANDING_FILTER_YEAR = "2026"

/** Filters applied when the user first opens CAF Monitoring. */
export function getLandingCafSiteFilters(): CafSiteFilters {
  return { year: [CAF_LANDING_FILTER_YEAR] }
}

/** Empty filters — Reset target; shows all rows. */
export function getClearedCafSiteFilters(): CafSiteFilters {
  return {}
}

/** Count non-empty filter groups (for Reset enablement / mobile badge). */
export function countActiveCafFilterGroups(filters: CafSiteFilters): number {
  let count = 0
  if (filters.q?.trim()) count += 1
  if ((filters.project_name?.length ?? 0) > 0) count += 1
  if ((filters.caf_status?.length ?? 0) > 0) count += 1
  if ((filters.vendor_tlp_name?.length ?? 0) > 0) count += 1
  if ((filters.vendor_requestor_name?.length ?? 0) > 0) count += 1
  if ((filters.caf_type?.length ?? 0) > 0) count += 1
  if ((filters.avp?.length ?? 0) > 0) count += 1
  if ((filters.year?.length ?? 0) > 0) count += 1
  return count
}

export type CafFilterableRow = {
  project_name?: string | null
  vendor_tlp_name?: string | null
  vendor_requestor_name?: string | null
  caf_status?: string | null
  caf_type?: string | null
  avp?: string | null
  staff?: string | null
  caf_number?: string | null
  site_id_indosat?: string | null
  site_name?: string | null
  created_date?: string | null
  approved_date?: string | null
  implemented_date?: string | null
  status_duration?: string | null
  rfs_af?: string | null
  endorse_af?: string | null
  patp_accepted_af?: string | null
}

function isNonEmptyString(v: unknown): v is string {
  return v !== null && v !== undefined && String(v).trim() !== ""
}

function normalizeString(v: unknown): string {
  return isNonEmptyString(v) ? String(v).trim().toLowerCase() : ""
}

/** Calendar year (YYYY) from an ISO date or timestamp string. */
export function extractCalendarYear(value: string | null | undefined): string | null {
  if (!isNonEmptyString(value)) return null
  const year = String(value).trim().slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

/** Calendar year from `rfs_af` — page Year filter and milestone split logic. */
export function extractRfsYear(rfsAf: string | null | undefined): string | null {
  return extractCalendarYear(rfsAf)
}

export function buildDateYearOrClause(column: string, years: string[]): string | null {
  const ranges = years
    .map((y) => Number.parseInt(String(y), 10))
    .filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100)
    .map((y) => `and(${column}.gte.${y}-01-01,${column}.lt.${y + 1}-01-01)`)

  if (ranges.length === 0) return null
  return ranges.join(",")
}

export function buildRfsYearOrClause(years: string[]): string | null {
  return buildDateYearOrClause("rfs_af", years)
}

export function cafFiltersToQueryString(filters: CafSiteFilters): string {
  const sp = new URLSearchParams()

  if (isNonEmptyString(filters.q)) sp.set("q", filters.q.trim())

  const appendAll = (key: string, values?: string[]) => {
    if (!Array.isArray(values) || values.length === 0) return
    for (const v of [...values].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append(key, v)
    }
  }

  appendAll("project_name", filters.project_name)
  appendAll("vendor_tlp_name", filters.vendor_tlp_name)
  appendAll("vendor_requestor_name", filters.vendor_requestor_name)
  appendAll("caf_status", filters.caf_status)
  appendAll("caf_type", filters.caf_type)
  appendAll("avp", filters.avp)
  appendAll("year", filters.year)

  return sp.toString()
}

export function parseCafFiltersFromSearchParams(searchParams: URLSearchParams): CafSiteFilters {
  const q = searchParams.get("q")?.trim() || undefined
  const project_name = searchParams.getAll("project_name")
  const vendor_tlp_name = searchParams.getAll("vendor_tlp_name")
  const vendor_requestor_name = searchParams.getAll("vendor_requestor_name")
  const caf_status = searchParams.getAll("caf_status")
  const caf_type = searchParams.getAll("caf_type")
  const avp = searchParams.getAll("avp")
  const year = searchParams.getAll("year")

  return {
    q,
    project_name: project_name.length > 0 ? project_name : undefined,
    vendor_tlp_name: vendor_tlp_name.length > 0 ? vendor_tlp_name : undefined,
    vendor_requestor_name: vendor_requestor_name.length > 0 ? vendor_requestor_name : undefined,
    caf_status: caf_status.length > 0 ? caf_status : undefined,
    caf_type: caf_type.length > 0 ? caf_type : undefined,
    avp: avp.length > 0 ? avp : undefined,
    year: year.length > 0 ? year : undefined,
  }
}

export function rowMatchesCafFilters(row: CafFilterableRow, filters: CafSiteFilters): boolean {
  if (isNonEmptyString(filters.q)) {
    const needle = filters.q.trim().toLowerCase()
    const haystack = [row.caf_number, row.site_id_indosat, row.site_name]
      .filter(isNonEmptyString)
      .map((v) => v.toLowerCase())
    if (!haystack.some((v) => v.includes(needle))) return false
  }

  if (Array.isArray(filters.project_name) && filters.project_name.length > 0) {
    const set = new Set(filters.project_name.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.project_name))) return false
  }

  if (Array.isArray(filters.vendor_tlp_name) && filters.vendor_tlp_name.length > 0) {
    const set = new Set(filters.vendor_tlp_name.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.vendor_tlp_name))) return false
  }

  if (Array.isArray(filters.vendor_requestor_name) && filters.vendor_requestor_name.length > 0) {
    const set = new Set(filters.vendor_requestor_name.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.vendor_requestor_name))) return false
  }

  if (Array.isArray(filters.caf_status) && filters.caf_status.length > 0) {
    const set = new Set(filters.caf_status.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.caf_status))) return false
  }

  if (Array.isArray(filters.caf_type) && filters.caf_type.length > 0) {
    const set = new Set(filters.caf_type.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.caf_type))) return false
  }

  if (Array.isArray(filters.avp) && filters.avp.length > 0) {
    const set = new Set(filters.avp.map((v) => normalizeString(v)))
    if (!set.has(normalizeString(row.avp))) return false
  }

  if (Array.isArray(filters.year) && filters.year.length > 0) {
    const rowYear = extractRfsYear(row.rfs_af)
    if (!rowYear) return false
    const set = new Set(filters.year.map((v) => String(v).trim()))
    if (!set.has(rowYear)) return false
  }

  return true
}

export function hasActiveCafFilters(filters: CafSiteFilters): boolean {
  return Boolean(cafFiltersToQueryString(filters))
}

/**
 * Build filter dropdown options from already-loaded site_data rows.
 * Avoids a second full-table scan via `/api/caf/filters` on the page.
 */
export function deriveCafFilterOptionsFromRows(rows: CafFilterableRow[]): CafFilterOptions {
  const projects = new Set<string>()
  const vendorTlp = new Set<string>()
  const vendorRequestor = new Set<string>()
  const cafStatus = new Set<string>()
  const cafType = new Set<string>()
  const avp = new Set<string>()
  const year = new Set<string>()

  for (const row of rows) {
    if (isNonEmptyString(row.project_name)) projects.add(String(row.project_name).trim())
    if (isNonEmptyString(row.vendor_tlp_name)) vendorTlp.add(String(row.vendor_tlp_name).trim())
    if (isNonEmptyString(row.vendor_requestor_name)) {
      vendorRequestor.add(String(row.vendor_requestor_name).trim())
    }
    if (isNonEmptyString(row.caf_status)) cafStatus.add(String(row.caf_status).trim())
    if (isNonEmptyString(row.caf_type)) cafType.add(String(row.caf_type).trim())
    if (isNonEmptyString(row.avp)) avp.add(String(row.avp).trim())
    const rfsYear = extractRfsYear(row.rfs_af)
    if (rfsYear) year.add(rfsYear)
  }

  const sortAsc = (values: Set<string>) =>
    Array.from(values).sort((a, b) => a.localeCompare(b))
  const sortYearDesc = (values: Set<string>) =>
    Array.from(values).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

  return {
    projects: sortAsc(projects),
    vendorTlp: sortAsc(vendorTlp),
    vendorRequestor: sortAsc(vendorRequestor),
    cafStatus: sortAsc(cafStatus),
    cafType: sortAsc(cafType),
    avp: sortAsc(avp),
    year: sortYearDesc(year),
  }
}

export function filterCafRows(rows: CafFilterableRow[], filters: CafSiteFilters): CafFilterableRow[] {
  if (!hasActiveCafFilters(filters)) return rows
  return rows.filter((row) => rowMatchesCafFilters(row, filters))
}

export type CafSiteFilters = {
  q?: string
  project_name?: string[]
  vendor_tlp_name?: string[]
  vendor_requestor_name?: string[]
  caf_status?: string[]
  caf_type?: string[]
  avp?: string[]
}

export type CafFilterableRow = {
  project_name?: string | null
  vendor_tlp_name?: string | null
  vendor_requestor_name?: string | null
  caf_status?: string | null
  caf_type?: string | null
  avp?: string | null
  caf_number?: string | null
  site_id_indosat?: string | null
  site_name?: string | null
  created_date?: string | null
  approved_date?: string | null
  implemented_date?: string | null
  status_duration?: string | null
}

function isNonEmptyString(v: unknown): v is string {
  return v !== null && v !== undefined && String(v).trim() !== ""
}

function normalizeString(v: unknown): string {
  return isNonEmptyString(v) ? String(v).trim().toLowerCase() : ""
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

  return {
    q,
    project_name: project_name.length > 0 ? project_name : undefined,
    vendor_tlp_name: vendor_tlp_name.length > 0 ? vendor_tlp_name : undefined,
    vendor_requestor_name: vendor_requestor_name.length > 0 ? vendor_requestor_name : undefined,
    caf_status: caf_status.length > 0 ? caf_status : undefined,
    caf_type: caf_type.length > 0 ? caf_type : undefined,
    avp: avp.length > 0 ? avp : undefined,
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

  return true
}

export function hasActiveCafFilters(filters: CafSiteFilters): boolean {
  return Boolean(cafFiltersToQueryString(filters))
}

export function filterCafRows(rows: CafFilterableRow[], filters: CafSiteFilters): CafFilterableRow[] {
  if (!hasActiveCafFilters(filters)) return rows
  return rows.filter((row) => rowMatchesCafFilters(row, filters))
}

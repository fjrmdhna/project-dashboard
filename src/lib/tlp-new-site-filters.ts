export type TlpSiteFilters = {
  year?: number[]
  program_name?: string[]
  wbs_status?: string[]
  site_category?: string[]
  twr_owner?: string[]
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
  if (Array.isArray(filters.program_name) && filters.program_name.length > 0) {
    for (const v of [...filters.program_name].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("program_name", v)
    }
  }
  if (Array.isArray(filters.wbs_status) && filters.wbs_status.length > 0) {
    for (const v of [...filters.wbs_status].map(String).sort((a, b) => a.localeCompare(b))) {
      if (isNonEmptyString(v)) sp.append("wbs_status", v)
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
  if (Array.isArray(filters.program_name) && filters.program_name.length > 0) {
    entries.push(["program_name", [...filters.program_name].sort((a, b) => a.localeCompare(b)).join(",")])
  }
  if (Array.isArray(filters.wbs_status) && filters.wbs_status.length > 0) {
    entries.push(["wbs_status", [...filters.wbs_status].sort((a, b) => a.localeCompare(b)).join(",")])
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

  const program_name = searchParams.getAll("program_name")
  const wbs_status = searchParams.getAll("wbs_status")
  const site_category = searchParams.getAll("site_category")
  const twr_owner = searchParams.getAll("twr_owner")

  return {
    year: year.length > 0 ? year : undefined,
    program_name: program_name.length > 0 ? program_name : undefined,
    wbs_status: wbs_status.length > 0 ? wbs_status : undefined,
    site_category: site_category.length > 0 ? site_category : undefined,
    twr_owner: twr_owner.length > 0 ? twr_owner : undefined,
  }
}

export function rowMatchesTlpFilters(
  row: {
    year?: number | string | null
    program_name?: string | null
    wbs_status?: string | null
    site_category?: string | null
    twr_owner?: string | null
  },
  filters: TlpSiteFilters
): boolean {
  if (Array.isArray(filters.year) && filters.year.length > 0) {
    const rowYear = typeof row.year === "number" ? row.year : Number(row.year)
    if (Number.isNaN(rowYear)) return false
    if (!filters.year.includes(rowYear)) return false
  }

  if (Array.isArray(filters.program_name) && filters.program_name.length > 0) {
    const rowVal = normalizeString(row.program_name)
    const set = new Set(filters.program_name.map((v) => normalizeString(v)))
    if (!set.has(rowVal)) return false
  }

  if (Array.isArray(filters.wbs_status) && filters.wbs_status.length > 0) {
    const rowVal = normalizeString(row.wbs_status)
    const set = new Set(filters.wbs_status.map((v) => normalizeString(v)))
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


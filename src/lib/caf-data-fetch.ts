import { getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import {
  buildRfsYearOrClause,
  parseCafFiltersFromSearchParams,
  type CafFilterableRow,
  type CafSiteFilters,
} from "@/lib/caf-filters"

const PAGE_SIZE = 1000

type CafQueryBuilder = {
  in: (column: string, values: string[]) => CafQueryBuilder
  or: (filters: string) => CafQueryBuilder
  range: (
    from: number,
    to: number
  ) => Promise<{ data: CafFilterableRow[] | null; error: { message: string } | null }>
}

function applyCafDbFilters(query: CafQueryBuilder, filters: CafSiteFilters): CafQueryBuilder {
  let q: CafQueryBuilder = query

  if (Array.isArray(filters.project_name) && filters.project_name.length > 0) {
    q = q.in("project_name", filters.project_name)
  }
  if (Array.isArray(filters.vendor_tlp_name) && filters.vendor_tlp_name.length > 0) {
    q = q.in("vendor_tlp_name", filters.vendor_tlp_name)
  }
  if (Array.isArray(filters.vendor_requestor_name) && filters.vendor_requestor_name.length > 0) {
    q = q.in("vendor_requestor_name", filters.vendor_requestor_name)
  }
  if (Array.isArray(filters.caf_status) && filters.caf_status.length > 0) {
    q = q.in("caf_status", filters.caf_status)
  }
  if (Array.isArray(filters.caf_type) && filters.caf_type.length > 0) {
    q = q.in("caf_type", filters.caf_type)
  }
  if (Array.isArray(filters.avp) && filters.avp.length > 0) {
    q = q.in("avp", filters.avp)
  }

  if (Array.isArray(filters.rfs_year) && filters.rfs_year.length > 0) {
    const yearOr = buildRfsYearOrClause(filters.rfs_year)
    if (yearOr) q = q.or(yearOr)
  }

  if (filters.q?.trim()) {
    const needle = filters.q.trim()
    q = q.or(
      `caf_number.ilike.%${needle}%,site_id_indosat.ilike.%${needle}%,site_name.ilike.%${needle}%`
    )
  }

  return q
}

export async function fetchAllCafRows(
  filters: CafSiteFilters,
  columns: string
): Promise<CafFilterableRow[]> {
  const supabase = getTlpSupabaseClient()
  const rows: CafFilterableRow[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const baseQuery = supabase.from("site_data_caf").select(columns) as unknown as CafQueryBuilder
    const { data, error } = await applyCafDbFilters(baseQuery, filters).range(
      offset,
      offset + PAGE_SIZE - 1
    )

    if (error) throw new Error(error.message)

    for (const row of data ?? []) {
      rows.push(row)
    }

    hasMore = Boolean(data && data.length === PAGE_SIZE)
    offset += PAGE_SIZE
  }

  return rows
}

export function parseCafFiltersFromRequest(request: Request): CafSiteFilters {
  const { searchParams } = new URL(request.url)
  return parseCafFiltersFromSearchParams(searchParams)
}

import { filterCafRows, type CafSiteFilters } from "@/lib/caf-filters"
import { fetchAllCafRows } from "@/lib/caf-data-fetch"
import { aggregateCafDashboard, type CafDashboardData } from "@/lib/caf-dashboard-aggregate"
import type { CafFilterableRow } from "@/lib/caf-filters"
import { getCacheOrFetch } from "@/lib/redis"

export const CAF_DASHBOARD_COLUMNS =
  "caf_status, caf_type, approved_date, implemented_date, created_date, status_duration, project_name, vendor_tlp_name, vendor_requestor_name, avp, caf_number, site_id_indosat, site_name, rfs_af, endorse_af, patp_accepted_af"

const SITE_DATA_CACHE_KEY = "caf-site-data:v2"
const CACHE_TTL_SECONDS = 120

type MemoryCacheEntry<T> = { data: T; expiry: number }
const processMemoryCache = new Map<string, MemoryCacheEntry<unknown>>()

async function getWithProcessMemoryCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const now = Date.now()
  const cached = processMemoryCache.get(key)
  if (cached && now < cached.expiry) {
    return cached.data as T
  }

  const data = await getCacheOrFetch<T>(key, fetchFn, ttlSeconds)
  processMemoryCache.set(key, { data, expiry: now + ttlSeconds * 1000 })
  return data
}

/** Fetch full CAF dataset once — reused for all filter combinations. */
export async function getCafSiteDataRows(): Promise<CafFilterableRow[]> {
  return getWithProcessMemoryCache(
    SITE_DATA_CACHE_KEY,
    () => fetchAllCafRows({}, CAF_DASHBOARD_COLUMNS),
    CACHE_TTL_SECONDS
  )
}

export async function getCafDashboardData(filters: CafSiteFilters): Promise<CafDashboardData> {
  const allRows = await getCafSiteDataRows()
  const filteredRows = filterCafRows(allRows, filters)
  return aggregateCafDashboard(filteredRows)
}

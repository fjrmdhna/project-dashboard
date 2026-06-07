import { createClient } from "@supabase/supabase-js"
import { supabase as publicSupabase } from "@/lib/supabase"
import type { TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export function hasNonEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }
  return String(value).trim() !== ""
}

export function getTlpSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return publicSupabase
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/** Push year filter to Postgres (indexed column year_from_wo). */
export function applyTlpYearDbFilter<Q>(query: Q, filters: TlpSiteFilters): Q {
  if (Array.isArray(filters.year) && filters.year.length > 0) {
    const filtered = query as Q & { in: (column: string, values: number[]) => Q }
    return filtered.in("year_from_wo", filters.year)
  }
  return query
}

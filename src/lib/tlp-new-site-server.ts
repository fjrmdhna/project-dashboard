import { createClient } from "@supabase/supabase-js"
import { supabase as publicSupabase } from "@/lib/supabase"
import { TLP_SCOPED_PROGRAM_GROUPS } from "@/lib/tlp-program-site-category"
import type { TlpSiteFilters } from "@/lib/tlp-new-site-filters"

type SupabaseInQuery<Q> = Q & { in: (column: string, values: readonly string[] | number[]) => Q }

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

/** Restrict TLP New Site queries to approved program_group values only. */
export function applyTlpProgramGroupScope<Q>(query: Q): Q {
  return (query as SupabaseInQuery<Q>).in("program_group", [...TLP_SCOPED_PROGRAM_GROUPS])
}

/** Push year filter to Postgres (indexed column year_from_wo). */
export function applyTlpYearDbFilter<Q>(query: Q, filters: TlpSiteFilters): Q {
  if (Array.isArray(filters.year) && filters.year.length > 0) {
    return (query as SupabaseInQuery<Q>).in("year_from_wo", filters.year)
  }
  return query
}

/** Base TLP New Site DB filters: scoped program groups + optional year. */
export function applyTlpDbFilters<Q>(query: Q, filters: TlpSiteFilters): Q {
  return applyTlpYearDbFilter(applyTlpProgramGroupScope(query), filters)
}

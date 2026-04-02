import { createClient } from "@supabase/supabase-js"
import { supabase as publicSupabase } from "@/lib/supabase"

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

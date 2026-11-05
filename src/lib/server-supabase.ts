import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase/PostgREST client with service_role JWT.
 * Required for upload/upsert/delete gateways writing to VPS Postgres.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (required for write gateways)')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-client-info': 'project-dashboard-upload-gateway',
      },
    },
  })
}

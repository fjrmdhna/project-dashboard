import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://opecotutdvtahsccpqzr.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for site_data_5g table
export interface SiteData5G {
  system_key: string
  vendor_name?: string
  program_report?: string
  imp_ttp?: string
  nano_cluster?: string
  caf_approved?: string
  mos_af?: string
  ic_000040_af?: string
  imp_integ_af?: string
  rfs_af?: string
  rfs_forecast_lock?: string
  mocn_activation_forecast?: string
  hotnews_af?: string
  endorse_af?: string
  created_at?: string
  updated_at?: string
}

// Helper function to get site data with filters
export async function getSiteData5G(filters: {
  vendor_name?: string[]
  program_report?: string[]
  imp_ttp?: string[]
  nano_cluster?: string[]
  search?: string
  limit?: number
  offset?: number
} = {}) {
  // Select only the columns we actually use on the dashboard
  const columns = [
    'system_key',
    'vendor_name',
    'program_report',
    'imp_ttp',
    'nano_cluster',
    'caf_approved',
    'mos_af',
    'ic_000040_af',
    'imp_integ_af',
    'rfs_af',
    'rfs_forecast_lock',
    'mocn_activation_forecast',
    'hotnews_af',
    'endorse_af'
  ].join(',')

  let query = supabase
    .from('site_data_5g')
    .select(columns, { count: 'exact' })

  // Apply filters
  if (filters.vendor_name && filters.vendor_name.length > 0) {
    query = query.in('vendor_name', filters.vendor_name)
  }

  if (filters.program_report && filters.program_report.length > 0) {
    query = query.in('program_report', filters.program_report)
  }

  if (filters.imp_ttp && filters.imp_ttp.length > 0) {
    query = query.in('imp_ttp', filters.imp_ttp)
  }

  if (filters.nano_cluster && filters.nano_cluster.length > 0) {
    query = query.in('nano_cluster', filters.nano_cluster)
  }

  if (filters.search) {
    query = query.or(`system_key.ilike.%${filters.search}%,site_id.ilike.%${filters.search}%,site_name.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%`)
  }

  // Apply pagination
  if (filters.offset !== undefined && filters.limit) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1)
  } else if (filters.limit) {
    query = query.limit(filters.limit)
  }

  // Provide a stable order to avoid inconsistent slices across environments
  query = query.order('system_key', { ascending: true })

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Supabase error: ${error.message}`)
  }

  // Ensure data is of the correct type or handle error case
  if (!data || !Array.isArray(data)) {
    return {
      data: [] as SiteData5G[],
      count: count || 0
    }
  }
  
  return {
    data: data as unknown as SiteData5G[],
    count: count || 0
  }
}

// Helper function to get filter options
export async function getFilterOptions() {
  const { data: vendors, error: vendorError } = await supabase
    .from('site_data_5g')
    .select('vendor_name')
    .not('vendor_name', 'is', null)

  const { data: programs, error: programError } = await supabase
    .from('site_data_5g')
    .select('program_report')
    .not('program_report', 'is', null)

  const { data: cities, error: cityError } = await supabase
    .from('site_data_5g')
    .select('imp_ttp')
    .not('imp_ttp', 'is', null)

  const { data: nanoClusters, error: nanoClusterError } = await supabase
    .from('site_data_5g')
    .select('nano_cluster')
    .not('nano_cluster', 'is', null)

  if (vendorError || programError || cityError || nanoClusterError) {
    throw new Error(`Supabase error: ${vendorError?.message || programError?.message || cityError?.message || nanoClusterError?.message}`)
  }

  return {
    vendors: [...new Set(vendors.map(v => v.vendor_name))].sort(),
    programs: [...new Set(programs.map(p => p.program_report))].sort(),
    cities: [...new Set(cities.map(c => c.imp_ttp))].sort(),
    nanoClusters: [...new Set(nanoClusters.map(nc => nc.nano_cluster))].sort()
  }
}

import { createClient } from '@supabase/supabase-js'
import { EXCLUDED_PROGRAM_REPORTS, filterExcludedProgramReports, shouldExcludeProgramReport } from './hermes-5g-constants'

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
  ran_score?: string | null
  issue_category?: string | null
  caf_approved?: string
  mos_af?: string
  ic_000040_af?: string
  imp_integ_af?: string
  rfs_af?: string
  rfs_forecast_lock?: string
  rfc_approved?: string
  mocn_activation_forecast?: string
  hotnews_af?: string
  endorse_af?: string
  pac_accepted_af?: string
  site_id?: string
  site_name?: string
  lat?: number | null
  long?: number | null
  created_at?: string
  updated_at?: string
}

// Helper function to get site data with filters
export interface SiteData5GFilters {
  vendor_name?: string[]
  program_report?: string[]
  imp_ttp?: string[]
  nano_cluster?: string[]
  ran_score?: string[]
  search?: string
  status?: string[] // New status filter
  limit?: number
  offset?: number
}

export interface SiteData5GOptions {
  includeExcludedProgramReports?: boolean
  onlyExcludedProgramReports?: boolean
}

export async function getSiteData5G(
  filters: SiteData5GFilters = {},
  options: SiteData5GOptions = {}
) {
  // Select only the columns we actually use on the dashboard
  const columns = [
    'system_key',
    'vendor_name',
    'program_report',
    'imp_ttp',
    'nano_cluster',
    'ran_score',
    'issue_category',
    'caf_approved',
    'mos_af',
    'ic_000040_af',
    'imp_integ_af',
    'rfs_af',
    'rfs_forecast_lock',
    'rfc_approved',
    'mocn_activation_forecast',
    'hotnews_af',
    'endorse_af',
    'pac_accepted_af',
    'site_id',
    'site_name',
    'lat',
    'long'
  ].join(',')

  const { includeExcludedProgramReports = false, onlyExcludedProgramReports = false } = options

  const requestedProgramReports =
    (filters.program_report ?? []).map(value => value?.trim()).filter((value): value is string => Boolean(value))

  const sanitizedProgramReports = onlyExcludedProgramReports
    ? requestedProgramReports
    : includeExcludedProgramReports
      ? requestedProgramReports
      : filterExcludedProgramReports(requestedProgramReports)

  if (
    !includeExcludedProgramReports &&
    !onlyExcludedProgramReports &&
    requestedProgramReports.length > 0 &&
    sanitizedProgramReports.length === 0
  ) {
    return {
      data: [] as SiteData5G[],
      count: 0
    }
  }

  let query = supabase
    .from('site_data_5g')
    .select(columns, { count: 'exact' })

  if (onlyExcludedProgramReports) {
    query = query.in('program_report', [...EXCLUDED_PROGRAM_REPORTS])
  } else if (!includeExcludedProgramReports) {
    EXCLUDED_PROGRAM_REPORTS.forEach((excludedProgram) => {
      query = query.neq('program_report', excludedProgram)
    })
  }

  // Apply filters
  if (filters.vendor_name && filters.vendor_name.length > 0) {
    query = query.in('vendor_name', filters.vendor_name)
  }

  if (!onlyExcludedProgramReports && sanitizedProgramReports.length > 0) {
    query = query.in('program_report', sanitizedProgramReports)
  }

  if (filters.imp_ttp && filters.imp_ttp.length > 0) {
    query = query.in('imp_ttp', filters.imp_ttp)
  }

  if (filters.nano_cluster && filters.nano_cluster.length > 0) {
    query = query.in('nano_cluster', filters.nano_cluster)
  }

  if (filters.ran_score && filters.ran_score.length > 0) {
    query = query.in('ran_score', filters.ran_score)
  }

  if (filters.search) {
    query = query.or(`system_key.ilike.%${filters.search}%,site_id.ilike.%${filters.search}%,site_name.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%`)
  }

  // Apply status filter - this will be handled after data retrieval
  // because status is calculated from boolean fields

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

  // Apply status filter if provided
  let filteredData = data as unknown as SiteData5G[]

  if (onlyExcludedProgramReports) {
    filteredData = filteredData.filter(row => shouldExcludeProgramReport(row.program_report))
  } else if (!includeExcludedProgramReports) {
    filteredData = filteredData.filter(row => !shouldExcludeProgramReport(row.program_report))
  }

  if (filters.status && filters.status.length > 0) {
    filteredData = filteredData.filter(row => {
      // Determine status based on boolean fields (same logic as in map-data API)
      let status = 'SOW' // Default status
      
      if (row.rfs_af) {
        status = 'ACTIVE'
      } else if (row.imp_integ_af) {
        status = 'READY'
      } else if (row.caf_approved) {
        status = 'RFI'
      }
      
      return filters.status!.includes(status)
    })
  }
  
  return {
    data: filteredData,
    count: count || 0
  }
}

// Helper function to get filter options
export async function getFilterOptions() {
  const { data: vendors, error: vendorError } = await supabase
    .from('site_data_5g')
    .select('vendor_name')
    .not('vendor_name', 'is', null)

  let programQuery = supabase
    .from('site_data_5g')
    .select('program_report')
    .not('program_report', 'is', null)

  EXCLUDED_PROGRAM_REPORTS.forEach((excludedProgram) => {
    programQuery = programQuery.neq('program_report', excludedProgram)
  })

  const { data: programs, error: programError } = await programQuery

  const { data: cities, error: cityError } = await supabase
    .from('site_data_5g')
    .select('imp_ttp')
    .not('imp_ttp', 'is', null)

  const { data: nanoClusters, error: nanoClusterError } = await supabase
    .from('site_data_5g')
    .select('nano_cluster')
    .not('nano_cluster', 'is', null)

  const { data: ranScores, error: ranScoreError } = await supabase
    .from('site_data_5g')
    .select('ran_score')
    .not('ran_score', 'is', null)
    .neq('ran_score', '')

  if (vendorError || programError || cityError || nanoClusterError || ranScoreError) {
    throw new Error(`Supabase error: ${vendorError?.message || programError?.message || cityError?.message || nanoClusterError?.message || ranScoreError?.message}`)
  }

  return {
    vendors: [...new Set(vendors.map(v => v.vendor_name))].sort(),
    programs: [...new Set(filterExcludedProgramReports(programs?.map(p => p.program_report)))].sort(),
    cities: [...new Set(cities.map(c => c.imp_ttp))].sort(),
    nanoClusters: [...new Set(nanoClusters.map(nc => nc.nano_cluster))].sort(),
    ranScores: [...new Set((ranScores || []).map(rs => rs.ran_score).filter((value): value is string => Boolean(value)))].sort()
  }
}

const formatCircleValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())

export async function getAopFilterOptions() {
  const fetchDistinctValues = async (column: string) => {
    const values = new Map<string, string>()
    const pageSize = 5000
    let page = 0
    let hasMore = true

    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1

      const { data, error } = await supabase
        .from('site_data_aop')
        .select(column)
        .not(column, 'is', null)
        .neq(column, '')
        .range(from, to)

      if (error) {
        throw error
      }

      const rows = (data as unknown) as Record<string, string | null>[] | null
      rows?.forEach(row => {
        const value = row[column]
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed) {
            const normalized = trimmed.toLowerCase()
            if (!values.has(normalized)) {
              const formatted =
                column === 'region_circle' ? formatCircleValue(trimmed) : trimmed
              values.set(normalized, formatted)
            }
          }
        }
      })

      hasMore = !!rows && rows.length === pageSize
      page += 1

      if (page > 50) {
        console.warn(`Pagination limit reached while fetching ${column}`)
        break
      }
    }

    return Array.from(values.values())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }

  const [vendors, programs, circles, ranScores] = await Promise.all([
    fetchDistinctValues('vendor_name'),
    fetchDistinctValues('program_report'),
    fetchDistinctValues('region_circle'),
    fetchDistinctValues('ran_score')
  ])

  return {
    vendors,
    programs,
    circles,
    ranScores
  }
}

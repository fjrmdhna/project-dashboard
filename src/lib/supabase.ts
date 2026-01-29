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

// Database types for site_data_tlp table
export interface SiteDataTLP {
  system_key: string
  'SBOQ.project_type'?: string | null
  network_header?: string | null
  project_name?: string | null
  program_name?: string | null
  site_id?: string | null
  site_name?: string | null
  wbs_status?: string | null
  year?: string | null
  new_site_id?: string | null
  new_site_name?: string | null
  region?: string | null
  site_category?: string | null
  twr_owner?: string | null
  vendor_code?: string | null
  wo_number_1?: string | null
  ic_000010_bf?: string | null
  ic_000010_ff?: string | null
  ic_000010_af?: string | null
  rfi_accepted?: string | null
  progress_status?: string | null
  price_month_actual?: string | null
  site_id_tlp?: string | null
  bauf_date?: string | null // DATE in database, returned as ISO string
  lease_start_clause?: string | null
  lease_start_date?: string | null // DATE in database, returned as ISO string
  administration_status?: string | null
  booking_status?: string | null
  issue_ny_sc?: string | null
  iom_date?: string | null // DATE in database, returned as ISO string
  iom_number?: string | null
  sc_number?: string | null
  po_number?: string | null
  baps_submit_date?: string | null // DATE in database, returned as ISO string
  baps_number?: string | null
  baps_date?: string | null // DATE in database, returned as ISO string
  baps_status?: string | null
  audit?: string | null
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
  region?: string[]
  year?: string[]
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
    'rfs_ff',            // Forecast - ProgressCurve, VendorLeaderboard, DailyRunrate
    'rfs_bf',            // Legacy baseline - kept for backward compatibility
    'rfs_forecast_lock',
    'rfc_approved',
    'mocn_activation_forecast',
    'hotnews_af',
    'endorse_af',
    'pac_accepted_af',
    'patp_accepted_af',  // PATP stats
    'site_id',
    'site_name',
    'lat',
    'long',
    'year',        // Year filter
    'region'       // Region filter
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

  if (filters.region && filters.region.length > 0) {
    query = query.in('region', filters.region)
  }

  if (filters.year && filters.year.length > 0) {
    query = query.in('year', filters.year)
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
      count: 0
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
  
  // BEST PRACTICE: Use filteredData.length as count to ensure accuracy
  // This ensures count matches the actual data returned after all filters are applied
  return {
    data: filteredData,
    count: filteredData.length
  }
}

// Helper function to get filter options
export async function getFilterOptions() {
  const { data: vendors, error: vendorError } = await supabase
    .from('site_data_5g')
    .select('vendor_name')
    .not('vendor_name', 'is', null)

  // All programs included - no exclusions
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
    programs: [...new Set(programs?.map(p => p.program_report) || [])].sort(), // All programs included - no exclusions
    cities: [...new Set(cities.map(c => c.imp_ttp))].sort(),
    nanoClusters: [...new Set(nanoClusters.map(nc => nc.nano_cluster))].sort(),
    ranScores: [...new Set((ranScores || []).map(rs => rs.ran_score).filter((value): value is string => Boolean(value)))].sort()
  }
}

const formatCircleValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())

/**
 * Normalize site_category value to grouped categories
 * Groups values containing "new" -> "New Site"
 * Groups values containing "existing" or "upgrade" -> "Expansion"
 * Other values remain as Title Case
 */
export function normalizeSiteCategoryValue(value: string): string {
  if (!value) return value
  
  const lowerValue = value.toLowerCase().trim()
  
  // Check for "new" keyword (case-insensitive) -> "New Site"
  if (lowerValue.includes('new')) {
    return 'New Site'
  }
  
  // Check for "existing" or "upgrade" keyword (case-insensitive) -> "Expansion"
  if (lowerValue.includes('existing') || lowerValue.includes('upgrade')) {
    return 'Expansion'
  }
  
  // Return Title Case for others
  return value
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Normalize ran_score value to grouped categories
 * Groups values containing:
 * - "co" and "new site" (case-insensitive, with or without dash) -> "Co New Site"
 * - "co" and "expansion" (case-insensitive, with or without dash) -> "Co Expansion" (unified, no dash)
 * - "new site" and "2026" (case-insensitive, without "co") -> "New Site 2026"
 * - "new site" and "2025" (case-insensitive, without "co") -> "New Site 2025"
 * - "expansion" and "2026" (case-insensitive, without "co") -> "Expansion 2026"
 * - "expansion" and "2025" (case-insensitive, without "co") -> "Expansion 2025"
 * Other values remain as Title Case
 */
export function normalizeRanScoreValue(value: string): string {
  if (!value) return value
  
  // Normalize multiple spaces to single space before checking
  const normalizedSpaces = value.replace(/\s+/g, ' ').trim()
  const lowerValue = normalizedSpaces.toLowerCase()
  
  // Check for "co" and "new site" (case-insensitive, handles multiple spaces and dashes)
  // Pattern: "co" as a word (not substring like in "scope") followed by optional spaces/dashes and "new site"
  // Use word boundary to ensure "co" is a separate word, not part of another word
  const hasCoAsWord = /\bco\b/i.test(normalizedSpaces)
  if (hasCoAsWord && lowerValue.includes('new site')) {
    return 'Co New Site'
  }
  
  // Check for "co" and "expansion" (case-insensitive, handles multiple spaces and dashes)
  // All variations (with or without dash) -> "Co Expansion" (unified, no dash)
  // This takes priority over expansion + year normalization
  // Use word boundary to ensure "co" is a separate word, not part of another word
  if (hasCoAsWord && lowerValue.includes('expansion')) {
    return 'Co Expansion'
  }
  
  // Check for "new site" and "2026" (case-insensitive, without "co" as a word)
  // Pattern: "new site" followed by optional spaces and "2026"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('new site') && lowerValue.includes('2026')) {
    return 'New Site 2026'
  }
  
  // Check for "new site" and "2025" (case-insensitive, without "co" as a word)
  // Pattern: "new site" followed by optional spaces and "2025"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('new site') && lowerValue.includes('2025')) {
    return 'New Site 2025'
  }
  
  // Check for "expansion" and "2026" (case-insensitive, without "co" as a word)
  // Pattern: "expansion" followed by optional spaces and "2026"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('expansion') && lowerValue.includes('2026')) {
    return 'Expansion 2026'
  }
  
  // Check for "expansion" and "2025" (case-insensitive, without "co" as a word)
  // Pattern: "expansion" followed by optional spaces and "2025"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('expansion') && lowerValue.includes('2025')) {
    return 'Expansion 2025'
  }
  
  // Return Title Case for others
  return normalizedSpaces
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format ran_score value with Title Case for display consistency
 * No grouping/normalization - returns as-is with proper casing
 * @deprecated Use normalizeRanScoreValue instead for consistency
 */
const formatRanScoreValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/**
 * Normalize priority_congest_urgent value
 * Groups values containing:
 * - "prio lebaran" (case-insensitive) -> "Prio Lebaran"
 * - "P1" (case-insensitive) -> "P1"
 * - "P2" (case-insensitive) -> "P2"
 * - "P3" (case-insensitive) -> "P3"
 * - "P4" (case-insensitive) -> "P4"
 * @param value The priority value to normalize
 * @returns Normalized priority value
 */
export function normalizePriorityCongestUrgentValue(value: string): string {
  if (!value) return value
  
  // Normalize multiple spaces to single space before checking
  const normalizedSpaces = value.replace(/\s+/g, ' ').trim()
  const lowerValue = normalizedSpaces.toLowerCase()
  
  // Check for "prio lebaran" keyword (case-insensitive, handles multiple spaces) -> "Prio Lebaran"
  if (lowerValue.includes('prio lebaran')) {
    return 'Prio Lebaran'
  }
  
  // Extract P1, P2, P3, or P4 (case-insensitive, can be standalone or part of text)
  // Pattern: matches "p1", "p2", "p3", "p4" (with optional spaces/dashes before/after)
  const p1Match = lowerValue.match(/\bp1\b/i)
  const p2Match = lowerValue.match(/\bp2\b/i)
  const p3Match = lowerValue.match(/\bp3\b/i)
  const p4Match = lowerValue.match(/\bp4\b/i)
  
  if (p1Match) {
    return 'P1'
  }
  if (p2Match) {
    return 'P2'
  }
  if (p3Match) {
    return 'P3'
  }
  if (p4Match) {
    return 'P4'
  }
  
  // Return original value for others (no normalization)
  return value
}

// In-memory cache untuk filter options dengan TTL
const filterOptionsCache = new Map<string, { data: any, timestamp: number }>()
const FILTER_OPTIONS_CACHE_TTL = 10 * 60 * 1000 // 10 menit

/**
 * Clear in-memory filter options cache
 * Call this when you need to force refresh filter options
 */
export function clearAopFilterOptionsCache() {
  filterOptionsCache.clear()
  console.log('[AOP Filters] In-memory cache cleared')
}

export async function getAopFilterOptions(forceRefresh = false) {
  // Check cache first (unless force refresh)
  const cacheKey = 'aop_filter_options'
  const cached = filterOptionsCache.get(cacheKey)
  const now = Date.now()
  
  if (!forceRefresh && cached && (now - cached.timestamp) < FILTER_OPTIONS_CACHE_TTL) {
    console.log(`[AOP Filters] Using cached data (age: ${Math.round((now - cached.timestamp) / 1000)}s)`)
    return cached.data
  }
  
  if (forceRefresh) {
    filterOptionsCache.delete(cacheKey)
    console.log(`[AOP Filters] Force refresh - clearing cache...`)
  }
  
  console.log(`[AOP Filters] Fetching fresh data from database...`)

  // OPTIMIZED: Fetch distinct values dengan pagination yang efisien
  // Menggunakan pagination untuk memastikan semua data ter-fetch
  const fetchDistinctValuesOptimized = async (column: string) => {
    const values = new Map<string, string>()
    
    try {
      // OPTIMIZED: Fetch dengan pagination untuk memastikan semua data ter-fetch
      // Distinct values biasanya tidak banyak, tapi kita perlu memastikan semua data ter-fetch
      const pageSize = 1000 // Supabase recommended page size
      let page = 0
      let hasMore = true
      const maxPages = 100 // Safety limit untuk mencegah infinite loop
      
      while (hasMore && page < maxPages) {
        const from = page * pageSize
        const to = from + pageSize - 1

        // Fetch data dengan pagination, filter null/empty di query level
        const { data, error } = await supabase
          .from('site_data_aop')
          .select(column)
          .not(column, 'is', null)
          .neq(column, '')
          .range(from, to)
          .order(column, { ascending: true }) // Order untuk konsistensi

        if (error) {
          throw error
        }

        const rows = (data as unknown) as Record<string, string | null>[] | null
        
        if (!rows || rows.length === 0) {
          hasMore = false
          break
        }

        // Process rows untuk extract distinct values
        rows.forEach(row => {
          const value = row[column]
          if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed) {
              // Format nilai berdasarkan kolom untuk konsistensi display
              let formatted: string
              let normalizedKey: string
              
              if (column === 'region_circle') {
                formatted = formatCircleValue(trimmed)
                normalizedKey = formatted.toLowerCase()
              } else if (column === 'site_category') {
                // Normalize site_category: group by "New Site" or "Expansion"
                formatted = normalizeSiteCategoryValue(trimmed)
                normalizedKey = formatted.toLowerCase()
              } else if (column === 'ran_score') {
                // Normalize ran_score: group by "Co - Expansion"
                formatted = normalizeRanScoreValue(trimmed)
                normalizedKey = formatted.toLowerCase()
              } else if (column === 'priority_congest_urgent') {
                // Normalize priority_congest_urgent: group by "Prio Lebaran"
                formatted = normalizePriorityCongestUrgentValue(trimmed)
                normalizedKey = formatted.toLowerCase()
              } else {
                formatted = trimmed
                normalizedKey = trimmed.toLowerCase()
              }
              
              if (!values.has(normalizedKey)) {
                values.set(normalizedKey, formatted)
              }
            }
          }
        })

        // Continue pagination jika masih ada data
        hasMore = rows.length === pageSize
        page += 1
      }

      if (page >= maxPages) {
        console.warn(`[AOP Filters] Pagination limit reached for ${column}, found ${values.size} distinct values`)
      } else {
        console.log(`[AOP Filters] Fetched ${values.size} distinct values for ${column} (${page} pages)`)
      }
    } catch (error) {
      console.error(`[AOP Filters] Error fetching distinct values for ${column}:`, error)
      // Return empty array on error instead of throwing
      return []
    }

    const result = Array.from(values.values())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    
    console.log(`[AOP Filters] Returning ${result.length} distinct ${column} values:`, result.slice(0, 10).join(', '), result.length > 10 ? '...' : '')
    
    return result
  }

  // OPTIMIZED: Fetch semua columns secara paralel dengan pagination per column
  // Setiap column akan di-fetch dengan pagination untuk memastikan semua data ter-fetch
  const [vendors, programs, circles, siteCategories, ranScoresRaw, years, priorityCongestUrgent] = await Promise.all([
    fetchDistinctValuesOptimized('vendor_name'),
    fetchDistinctValuesOptimized('program_report'),
    fetchDistinctValuesOptimized('region_circle'),
    fetchDistinctValuesOptimized('site_category'),
    fetchDistinctValuesOptimized('ran_score'),
    fetchDistinctValuesOptimized('year'),
    fetchDistinctValuesOptimized('priority_congest_urgent')
  ])

  // Normalize ranScores: apply normalization and deduplicate
  const normalizedRanScores = new Set<string>()
  for (const rs of ranScoresRaw) {
    if (rs) {
      const normalized = normalizeRanScoreValue(rs)
      normalizedRanScores.add(normalized)
    }
  }
  const ranScores = Array.from(normalizedRanScores).sort()

  const result = {
    vendors,
    programs,
    circles,
    siteCategories,
    ranScores,
    years: years.sort((a, b) => b.localeCompare(a)), // Sort years descending (newest first)
    priorityCongestUrgent
  }

  // Cache hasil
  filterOptionsCache.set(cacheKey, { data: result, timestamp: now })
  
  // Cleanup cache yang expired (simple cleanup)
  if (filterOptionsCache.size > 10) {
    for (const [key, value] of filterOptionsCache.entries()) {
      if ((now - value.timestamp) >= FILTER_OPTIONS_CACHE_TTL) {
        filterOptionsCache.delete(key)
      }
    }
  }

  return result
}

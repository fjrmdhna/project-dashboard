import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  getCache, 
  setCache, 
  getFilterHash, 
  isEmptyFilter,
  CACHE_KEYS, 
  CACHE_TTL,
  type FilterParams 
} from '@/lib/redis'

// Interface for the response data
interface SiteDataResponse {
  data: any[]
  count: number
  totalCount: number
  stats: {
    totalSites: number
    caf: number
    mos: number
    install: number
    readiness: number
    activated: number
    rfc: number
    fatp: number
    patp: number
    hotnews: number
    endorse: number
    pac: number
    nanoClusters: number
  }
}

// Full columns for detailed views
const FULL_COLUMNS = [
  'system_key',
  'vendor_name',
  'program_report',
  'rfi_accepted', // CRFI
  'mos_af',
  'ic_000010_af', // RFI
  'ic_000040_af', // INSTALL
  'imp_integ_af',
  'rfs_bf', // Baseline
  'rfs_ff', // Forecast
  'rfs_af', // Actual (Activated/RFS)
  'rfc_approved',
  'fatp_accepted_af', // FATP
  'patp_accepted_af', // PATP
  'ran_score',
  'hotnews_af', // HN
  'endorse_af', // Endorse
  'pac_accepted_af', // PAC
  'site_id',
  'site_name',
  'latitude',
  'longitude',
  'region',
  'region_circle',
  'site_category'
]

// Minimal columns for dashboard (reduces data from ~27MB to ~10MB)
// Includes fields needed by dashboard components AND client-side filtering
const MINIMAL_COLUMNS = [
  'system_key',        // Required for key + Search
  'site_id',           // Search
  'site_name',        // Search
  'vendor_name',       // VendorLeaderboard + Filter + Search
  'program_report',    // Filter + Search
  'region_circle',     // Readiness/Activated cards + Filter
  'site_category',     // Filter
  'ran_score',         // Legacy; kept for compatibility
  'pm_indosat',        // Project filter (AOP)
  'wbs_status',        // WBS Status filter
  'year',              // Year filter
  'ic_000010_af',      // RFI - ReadinessCard
  'imp_integ_af',      // Readiness - VendorLeaderboard
  'mocn_activation_forecast', // Baseline - ProgressCurve (replaces rfs_bf)
  'rfs_bf',            // Legacy Baseline - kept for backward compatibility
  'rfs_ff',            // Forecast - ProgressCurve, VendorLeaderboard, DailyRunrate
  'rfs_forecast',     // Forecast (alternate, e.g. for Lebaran template) - ProgressCurve
  'rfs_af',            // Actual - ProgressCurve, ActivatedCard, VendorLeaderboard, DailyRunrate
  'ready_for_acpt_date', // RFA - MatrixStatsCard (Ready for Acceptance)
  'rfi_accepted',      // CAF stats
  'mos_af',            // MOS stats
  'project_name',      // AgingPoCard - project grouping
  'po_date',           // AgingPoCard - PO aging calculation
  'po_number',         // AgingPoCard - unique PO count
  'pic_indosat',       // Trial GB Factory filter
  'ic_000040_af',      // Install stats
  'rfc_approved',      // RFC stats
  'fatp_accepted_af',  // FATP stats - Matrix milestone
  'patp_accepted_af',  // PATP stats
  'hotnews_af',        // Hotnews stats
  'endorse_af',        // Endorse stats
  'pac_accepted_af',   // PAC stats
  'issue_category',    // TopIssue - client-side calculation
  'priority_congest_urgent', // Priority filter
]

// Get columns based on mode
const getColumns = (mode: 'full' | 'minimal' = 'full') => {
  return mode === 'minimal' ? MINIMAL_COLUMNS.join(',') : FULL_COLUMNS.join(',')
}

// Helper function to optimize value - remove null/undefined and trim strings
function optimizeValue(value: any): any {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  return value
}

// Helper function to map raw data to frontend format
function mapDataToFrontend(filteredData: any[], mode: 'full' | 'minimal' = 'full'): any[] {
  if (mode === 'minimal') {
    // Minimal mapping - essential fields for dashboard + client-side filtering
    // OPTIMIZATION: Only include fields that have values (undefined instead of null reduces JSON size)
    return filteredData.map(row => {
      const mapped: any = {}
      
      // Always include system_key (required)
      mapped.system_key = row.system_key
      // Include for client-side search (system key, site id, site name)
      if (row.site_id != null && row.site_id !== '') mapped.site_id = String(row.site_id).trim()
      if (row.site_name) mapped.site_name = row.site_name.trim()

      // Only include non-empty values
      if (row.vendor_name) mapped.vendor_name = row.vendor_name.trim()
      if (row.program_report) mapped.program_report = row.program_report.trim()
      if (row.region_circle) mapped.region_circle = row.region_circle.trim()
      if (row.site_category) mapped.site_category = row.site_category.trim()
      if (row.ran_score) mapped.ran_score = row.ran_score.trim()
      if (row.pm_indosat) mapped.pm_indosat = row.pm_indosat.trim()
      if (row.wbs_status) mapped.wbs_status = row.wbs_status.trim()
      if (row.year) mapped.year = row.year.trim()
      
      // Stats fields - only include if not null/empty
      if (row.rfi_accepted) mapped.caf_approved = row.rfi_accepted.trim()
      if (row.mos_af) mapped.mos_af = row.mos_af.trim()
      if (row.ic_000010_af) mapped.ic_000010_af = row.ic_000010_af.trim()
      if (row.ic_000040_af) mapped.ic_000040_af = row.ic_000040_af.trim()
      if (row.imp_integ_af) mapped.imp_integ_af = row.imp_integ_af.trim()
      if (row.mocn_activation_forecast) mapped.mocn_activation_forecast = row.mocn_activation_forecast.trim()
      if (row.rfs_bf) mapped.rfs_bf = row.rfs_bf.trim()
      if (row.rfs_ff) mapped.rfs_ff = row.rfs_ff.trim()
      if (row.rfs_forecast) mapped.rfs_forecast = row.rfs_forecast.trim()
      if (row.rfs_af) mapped.rfs_af = row.rfs_af.trim()
      if (row.ready_for_acpt_date) mapped.ready_for_acpt_date = row.ready_for_acpt_date.trim()
      if (row.rfc_approved) mapped.rfc_approved = row.rfc_approved.trim()
      if (row.fatp_accepted_af) mapped.fatp_accepted_af = row.fatp_accepted_af.trim()
      if (row.patp_accepted_af) mapped.patp_accepted_af = row.patp_accepted_af.trim()
      if (row.hotnews_af) mapped.hotnews_af = row.hotnews_af.trim()
      if (row.endorse_af) mapped.endorse_af = row.endorse_af.trim()
      if (row.pac_accepted_af) mapped.pac_accepted_af = row.pac_accepted_af.trim()
      if (row.issue_category) mapped.issue_category = row.issue_category.trim()
      if (row.project_name) mapped.project_name = row.project_name.trim()
      if (row.po_date) mapped.po_date = row.po_date.trim()
      if (row.po_number) mapped.po_number = row.po_number.trim()
      if (row.pic_indosat) mapped.pic_indosat = row.pic_indosat.trim()
      if (row.priority_congest_urgent) mapped.priority_congest_urgent = row.priority_congest_urgent.trim()
      
      return mapped
    })
  }
  
  // Full mapping for detailed views
  return filteredData.map(row => ({
    system_key: row.system_key,
    vendor_name: row.vendor_name,
    program_report: row.program_report,
    caf_approved: row.rfi_accepted || null,
    mos_af: row.mos_af || null,
    ic_000040_af: row.ic_000040_af || null,
    ic_000010_af: row.ic_000010_af || null,
    rfi_accepted: row.rfi_accepted || null,
    imp_integ_af: row.imp_integ_af || null,
    rfs_bf: row.rfs_bf || null,
    rfs_ff: row.rfs_ff || null,
    rfs_af: row.rfs_af || null,
    rfc_approved: row.rfc_approved || null,
    fatp_accepted_af: row.fatp_accepted_af || null,
    patp_accepted_af: row.patp_accepted_af || null,
    ran_score: row.ran_score || null,
    hotnews_af: row.hotnews_af || null,
    endorse_af: row.endorse_af || null,
    pac_accepted_af: row.pac_accepted_af || null,
    priority_congest_urgent: row.priority_congest_urgent || null,
    site_id: row.site_id || null,
    site_name: row.site_name || null,
    lat: row.latitude || null,
    long: row.longitude || null,
    imp_ttp: row.region || null,
    nano_cluster: row.region_circle || null,
    region_circle: row.region_circle || null,
    site_category: row.site_category || null
  }))
}

// Helper function to check if a date field has a valid value
function hasValidDateValue(value: any): boolean {
  if (value === null || value === undefined) return false
  const str = String(value).trim()
  if (str === '' || str === 'null' || str === 'undefined' || str === 'NULL' || str === 'UNDEFINED') return false
  // Accept any non-empty string as valid (date validation happens at database level)
  // This matches the database function logic: IS NOT NULL
  return true
}

// Helper function to check if a field exists in row (for minimal mode where null fields are omitted)
function hasField(row: any, fieldName: string): boolean {
  return fieldName in row && row[fieldName] !== null && row[fieldName] !== undefined
}

// Helper function to calculate stats from data (fallback)
function calculateStatsFromData(filteredData: any[]) {
  // Count non-null, non-empty values for each milestone
  const cafCount = filteredData.filter(row => hasValidDateValue(row.rfi_accepted)).length
  const mosCount = filteredData.filter(row => hasValidDateValue(row.mos_af)).length
  const installCount = filteredData.filter(row => hasValidDateValue(row.ic_000040_af)).length
  const readinessCount = filteredData.filter(row => hasValidDateValue(row.imp_integ_af)).length
  const activatedCount = filteredData.filter(row => hasValidDateValue(row.rfs_af)).length
  const rfcCount = filteredData.filter(row => hasValidDateValue(row.rfc_approved)).length
  // FATP: Count rows where fatp_accepted_af is not null/empty and is a valid date
  // In minimal mode, null fields are omitted (undefined), so we need to check both existence and value
  const fatpCount = filteredData.filter(row => {
    // Check if field exists in row (minimal mode omits null fields)
    if (!hasField(row, 'fatp_accepted_af')) return false
    // Check if value is valid
    return hasValidDateValue(row.fatp_accepted_af)
  }).length
  // PATP: Count rows where patp_accepted_af is not null/empty and is a valid date
  const patpCount = filteredData.filter(row => {
    if (!hasField(row, 'patp_accepted_af')) return false
    return hasValidDateValue(row.patp_accepted_af)
  }).length
  const hotnewsCount = filteredData.filter(row => hasValidDateValue(row.hotnews_af)).length
  const endorseCount = filteredData.filter(row => hasValidDateValue(row.endorse_af)).length
  const pacCount = filteredData.filter(row => hasValidDateValue(row.pac_accepted_af)).length
  
  // Debug logging for FATP (only log if count is 0 to help diagnose issues)
  if (fatpCount === 0 && filteredData.length > 0) {
    // Sample a few rows to check if fatp_accepted_af exists in data
    const sampleRows = filteredData.slice(0, 3).map(r => ({ 
      system_key: r.system_key, 
      has_fatp: !!r.fatp_accepted_af,
      fatp_value: r.fatp_accepted_af 
    }))
    console.warn(`[AOP Site Data] Fallback calculation: FATP count is 0. Sample rows:`, sampleRows)
  }
  const uniqueClusters = new Set<string>()
  filteredData.forEach(row => {
    if (row.region_circle) {
      uniqueClusters.add(row.region_circle)
    }
  })
  
  return {
    totalSites: filteredData.length,
    caf: cafCount,
    mos: mosCount,
    install: installCount,
    readiness: readinessCount,
    activated: activatedCount,
    rfc: rfcCount,
    fatp: fatpCount,
    patp: patpCount,
    hotnews: hotnewsCount,
    endorse: endorseCount,
    pac: pacCount,
    nanoClusters: uniqueClusters.size
  }
}

// Fetch data from database with pagination
async function fetchDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string,
  mode: 'full' | 'minimal' = 'full'
): Promise<{ data: any[], totalCount: number }> {
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const pageSize = 1000
  const MAX_PAGES = 100
  let totalCount = 0
  
  const columns = getColumns(mode)

  // Build base query
  let baseQuery = supabase
    .from('site_data_aop')
    .select(columns, { count: 'exact' })

  // Apply filters
  if (vendorNames.length > 0) {
    baseQuery = baseQuery.in('vendor_name', vendorNames)
  }

  if (programReports.length > 0) {
    baseQuery = baseQuery.in('program_report', programReports)
  }

  if (circles.length > 0) {
    const circleConditions = circles
      .map(c => {
        const normalized = c.trim().toLowerCase()
        return `region_circle.ilike.${normalized}`
      })
      .join(',')
    baseQuery = baseQuery.or(circleConditions)
  }

  if (siteCategories.length > 0) {
    const siteCategoryConditions = siteCategories
      .map(sc => {
        const normalized = sc.trim().toLowerCase()
        return `site_category.ilike.${normalized}`
      })
      .join(',')
    baseQuery = baseQuery.or(siteCategoryConditions)
  }

  if (q) {
    baseQuery = baseQuery.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`)
  }

  // Fetch all data using pagination
  while (hasMore && page < MAX_PAGES) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const query = baseQuery.range(from, to)
    const { data: pageData, error: pageError, count } = await query

    if (pageError) {
      if (pageError.code === 'PGRST116') {
        return { data: [], totalCount: 0 }
      }
      throw new Error(`Database error: ${pageError.message}`)
    }

    if (count !== null && totalCount === 0) {
      totalCount = count
    }

    if (pageData && pageData.length > 0) {
      allData = [...allData, ...pageData]
      hasMore = pageData.length === pageSize
      page++
    } else {
      hasMore = false
    }
  }

  if (page >= MAX_PAGES) {
    console.warn(`[AOP Site Data] Pagination safety limit reached at ${page} pages, fetched ${allData.length} records`)
  }

  return { data: allData, totalCount }
}

// Fetch stats from database function
async function fetchStatsFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string
): Promise<{ stats: SiteDataResponse['stats'], hasFatpCount: boolean, hasPatpCount: boolean } | null> {
  const vendorNamesParam = vendorNames.length > 0 ? vendorNames : null
  const programReportsParam = programReports.length > 0 ? programReports : null
  const circlesParam = circles.length > 0 ? circles : null
  const siteCategoriesParam = siteCategories.length > 0 ? siteCategories : null
  const searchParam = q || null

  const { data: statsData, error: statsError } = await supabase.rpc('get_aop_stats', {
    p_vendor_names: vendorNamesParam,
    p_program_reports: programReportsParam,
    p_circles: circlesParam,
    p_site_categories: siteCategoriesParam,
    p_search: searchParam
  })

  if (!statsError && statsData && statsData.length > 0) {
    const statsRow = statsData[0]
    // Check if fatp_count exists in response (database function might not be updated yet)
    const hasFatpCount = 'fatp_count' in statsRow && statsRow.fatp_count !== undefined
    const fatpCount = hasFatpCount ? (Number(statsRow.fatp_count) || 0) : 0 // Default to 0 if not available
    // Check if patp_count exists in response (database function might not be updated yet)
    const hasPatpCount = 'patp_count' in statsRow && statsRow.patp_count !== undefined
    const patpCount = hasPatpCount ? (Number(statsRow.patp_count) || 0) : 0 // Default to 0 if not available
    
    if (!hasFatpCount) {
      console.warn('[AOP Site Data] Database function get_aop_stats does not have fatp_count. Will use fallback calculation from fetched data.')
    }
    if (!hasPatpCount) {
      console.warn('[AOP Site Data] Database function get_aop_stats does not have patp_count. Will use fallback calculation from fetched data.')
    }
    
    return {
      stats: {
        totalSites: Number(statsRow.total_sites) || 0,
        caf: Number(statsRow.caf_count) || 0,
        mos: Number(statsRow.mos_count) || 0,
        install: Number(statsRow.install_count) || 0,
        readiness: Number(statsRow.readiness_count) || 0,
        activated: Number(statsRow.activated_count) || 0,
        rfc: Number(statsRow.rfc_count) || 0,
        fatp: fatpCount, // Always a number (0 if DB function doesn't have it yet - will be replaced by fallback)
        patp: patpCount, // Always a number (0 if DB function doesn't have it yet - will be replaced by fallback)
        hotnews: Number(statsRow.hotnews_count) || 0,
        endorse: Number(statsRow.endorse_count) || 0,
        pac: Number(statsRow.pac_count) || 0,
        nanoClusters: Number(statsRow.cluster_count) || 0
      },
      hasFatpCount,
      hasPatpCount
    }
  }

  if (statsError) {
    console.warn('Database function get_aop_stats failed:', statsError)
    // Don't throw - let caller use fallback calculation
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const circles = searchParams.getAll('region_circle') || []
    const siteCategories = searchParams.getAll('site_category') || []
    
    // Mode: 'minimal' for dashboard (smaller payload ~5MB), 'full' for detailed views (~27MB)
    const mode = (searchParams.get('mode') || 'minimal') as 'full' | 'minimal'

    // Create filter params for cache key
    const filterParams: FilterParams = {
      vendorNames,
      programReports,
      circles,
      siteCategories,
      search: q
    }

    // Generate cache key based on filters
    const filterHash = getFilterHash(filterParams)
    const isEmpty = isEmptyFilter(filterParams)
    
    // Use different cache key for no-filter vs filtered
    const cacheKey = isEmpty 
      ? CACHE_KEYS.AOP_SITE_DATA_NOFILTER 
      : CACHE_KEYS.AOP_SITE_DATA(filterHash)
    
    // Use longer TTL for no-filter data (base data)
    const cacheTTL = isEmpty ? CACHE_TTL.FULL_DATA : CACHE_TTL.FILTERED_DATA

    // Try to get STATS from Redis cache first (full data is too large to cache)
    const statsCacheKey = CACHE_KEYS.AOP_STATS(filterHash)
    const cachedStats = await getCache<SiteDataResponse['stats']>(statsCacheKey)
    
    // We don't cache full data because it's too large (40k+ records = ~20MB)
    // Instead, we only cache stats which is small

    // Fetch from database
    console.log(`[AOP Site Data] Fetching from database (mode: ${mode})...`)
    const startTime = Date.now()

    // If we have cached stats, we can skip stats fetch
    let stats: SiteDataResponse['stats']
    let dataResult: { data: any[], totalCount: number }

    if (cachedStats) {
      console.log(`[AOP Site Data] Using cached stats for filter: ${filterHash}`)
      // Check if cached stats has fatp or patp (might be old cache from before these were added)
      if (cachedStats.fatp === undefined || cachedStats.patp === undefined) {
        console.warn('[AOP Site Data] Cached stats missing fatp or patp, will recalculate from fetched data')
        // Fetch data first, then recalculate fatp and patp from data
        dataResult = await fetchDataFromDatabase(vendorNames, programReports, circles, siteCategories, q, mode)
        const fallbackStats = calculateStatsFromData(dataResult.data)
        // Merge cached stats with fallback fatp and patp
        stats = { 
          ...cachedStats, 
          fatp: cachedStats.fatp ?? fallbackStats.fatp,
          patp: cachedStats.patp ?? fallbackStats.patp
        }
        // Update cache with new stats that include fatp and patp
        setCache(statsCacheKey, stats, CACHE_TTL.STATS).catch(err => {
          console.error('[AOP Site Data] Failed to update cached stats:', err)
        })
      } else {
        stats = cachedStats
        // Still need to fetch data
        dataResult = await fetchDataFromDatabase(vendorNames, programReports, circles, siteCategories, q, mode)
      }
    } else {
      // Fetch data and stats in parallel
      const [fetchedData, dbStatsResult] = await Promise.all([
        fetchDataFromDatabase(vendorNames, programReports, circles, siteCategories, q, mode),
        fetchStatsFromDatabase(vendorNames, programReports, circles, siteCategories, q)
      ])
      dataResult = fetchedData
      // If stats RPC timeout or failed, OR if fatp_count is missing from DB function, calculate from fetched data (fallback)
      if (!dbStatsResult) {
        // No stats from DB function - use full fallback
        stats = calculateStatsFromData(dataResult.data)
        console.log(`[AOP Site Data] Using fallback stats calculation. FATP count: ${stats.fatp}, PATP count: ${stats.patp}`)
      } else if (!dbStatsResult.hasFatpCount || !dbStatsResult.hasPatpCount) {
        // DB function exists but missing fatp_count or patp_count - merge with fallback
        const fallbackStats = calculateStatsFromData(dataResult.data)
        stats = { 
          ...dbStatsResult.stats, 
          fatp: dbStatsResult.hasFatpCount ? dbStatsResult.stats.fatp : fallbackStats.fatp,
          patp: dbStatsResult.hasPatpCount ? dbStatsResult.stats.patp : fallbackStats.patp
        }
        console.log(`[AOP Site Data] Database function missing fatp_count or patp_count, using fallback calculation. FATP count: ${stats.fatp}, PATP count: ${stats.patp}`)
        // Update cache with stats that include fatp and patp
        setCache(statsCacheKey, stats, CACHE_TTL.STATS).catch(err => {
          console.error('[AOP Site Data] Failed to update cached stats with fatp/patp:', err)
        })
      } else {
        // DB function has all fields including fatp and patp
        stats = dbStatsResult.stats
        console.log(`[AOP Site Data] Using database function stats. FATP count: ${stats.fatp}, PATP count: ${stats.patp}`)
      }
      
      // Cache only stats (small data, ~1KB) - don't cache full data (too large ~20MB)
      setCache(statsCacheKey, stats, CACHE_TTL.STATS).catch(err => {
        console.error('[AOP Site Data] Failed to cache stats:', err)
      })
    }

    const { data: filteredData, totalCount } = dataResult

    // Map data to frontend format with mode
    const mappedData = mapDataToFrontend(filteredData, mode)

    const fetchTime = Date.now() - startTime
    console.log(`[AOP Site Data] Database fetch completed in ${fetchTime}ms, ${mappedData.length} records`)

    // Prepare response data (NOT cached because too large)
    const responseData: SiteDataResponse = {
      data: mappedData,
      count: mappedData.length,
      totalCount,
      stats
    }
    
    // Warn if response size is too large (could cause issues)
    const responseSizeEstimate = JSON.stringify(responseData).length
    const responseSizeMB = responseSizeEstimate / 1024 / 1024
    if (responseSizeMB > 20) {
      console.warn(`[AOP Site Data] Large response size: ${responseSizeMB.toFixed(2)}MB. Consider pagination or filtering.`)
    }
    
    // Response headers (Vercel automatically compresses with gzip for large responses)
    const responseHeaders: Record<string, string> = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }

    // NOTE: We don't cache full response because data is too large (40k+ records = ~20MB)
    // Vercel KV has 256KB limit per value. We only cache stats above.

    return NextResponse.json({
      status: 'success',
      ...responseData,
      timestamp: new Date().toISOString(),
      cached: false,
      fetchTime,
      mode
    }, {
      headers: responseHeaders
    })
  } catch (error) {
    console.error('Error in AOP site-data API route:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal server error',
        data: [],
        count: 0,
        stats: {
          totalSites: 0,
          caf: 0,
          mos: 0,
          install: 0,
          readiness: 0,
          activated: 0,
          rfc: 0,
          fatp: 0,
          patp: 0,
          hotnews: 0,
          endorse: 0,
          pac: 0,
          nanoClusters: 0
        }
      },
      { status: 500 }
    )
  }
}

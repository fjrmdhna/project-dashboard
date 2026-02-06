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
  'system_key',        // Required for key
  'vendor_name',       // VendorLeaderboard + Filter
  'program_report',    // Filter
  'region_circle',     // Readiness/Activated cards + Filter
  'site_category',     // Filter
  'ran_score',         // RAN Score filter
  'year',              // Year filter
  'ic_000010_af',      // RFI - ReadinessCard
  'imp_integ_af',      // Readiness - VendorLeaderboard
  'mocn_activation_forecast', // Baseline - ProgressCurve (replaces rfs_bf)
  'rfs_bf',            // Legacy Baseline - kept for backward compatibility
  'rfs_ff',            // Forecast - ProgressCurve, VendorLeaderboard, DailyRunrate
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
      
      // Only include non-empty values
      if (row.vendor_name) mapped.vendor_name = row.vendor_name.trim()
      if (row.program_report) mapped.program_report = row.program_report.trim()
      if (row.region_circle) mapped.region_circle = row.region_circle.trim()
      if (row.site_category) mapped.site_category = row.site_category.trim()
      if (row.ran_score) mapped.ran_score = row.ran_score.trim()
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
      if (row.rfs_af) mapped.rfs_af = row.rfs_af.trim()
      if (row.ready_for_acpt_date) mapped.ready_for_acpt_date = row.ready_for_acpt_date.trim()
      if (row.rfc_approved) mapped.rfc_approved = row.rfc_approved.trim()
      if (row.fatp_accepted_af) mapped.fatp_accepted_af = row.fatp_accepted_af.trim()
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

// Helper function to calculate stats from data (fallback)
function calculateStatsFromData(filteredData: any[]) {
  const cafCount = filteredData.filter(row => row.rfi_accepted).length
  const mosCount = filteredData.filter(row => row.mos_af).length
  const installCount = filteredData.filter(row => row.ic_000040_af).length
  const readinessCount = filteredData.filter(row => row.imp_integ_af).length
  const activatedCount = filteredData.filter(row => row.rfs_af).length
  const rfcCount = filteredData.filter(row => row.rfc_approved).length
  const fatpCount = filteredData.filter(row => row.fatp_accepted_af).length
  const hotnewsCount = filteredData.filter(row => row.hotnews_af).length
  const endorseCount = filteredData.filter(row => row.endorse_af).length
  const pacCount = filteredData.filter(row => row.pac_accepted_af).length
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
  // #region agent log
  const paginationStartTime = Date.now();
  fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:261',message:'Pagination loop start',data:{mode,pageSize,MAX_PAGES},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  while (hasMore && page < MAX_PAGES) {
    const from = page * pageSize
    const to = from + pageSize - 1

    // #region agent log
    const pageQueryStartTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:265',message:'Before page query',data:{page,from,to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const query = baseQuery.range(from, to)
    const { data: pageData, error: pageError, count } = await query
    // #region agent log
    const pageQueryEndTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:266',message:'After page query',data:{page,queryDuration:pageQueryEndTime-pageQueryStartTime,recordCount:pageData?.length||0,hasError:!!pageError,errorCode:pageError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (pageError) {
      if (pageError.code === 'PGRST116') {
        return { data: [], totalCount: 0 }
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:272',message:'Database error in pagination',data:{page,errorCode:pageError.code,errorMessage:pageError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
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
  // #region agent log
  const paginationEndTime = Date.now();
  fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:292',message:'Pagination complete',data:{totalPages:page,totalRecords:allData.length,totalDuration:paginationEndTime-paginationStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return { data: allData, totalCount }
}

// Fetch stats from database function
async function fetchStatsFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string
) {
  const vendorNamesParam = vendorNames.length > 0 ? vendorNames : null
  const programReportsParam = programReports.length > 0 ? programReports : null
  const circlesParam = circles.length > 0 ? circles : null
  const siteCategoriesParam = siteCategories.length > 0 ? siteCategories : null
  const searchParam = q || null

  // #region agent log
  const statsQueryStartTime = Date.now();
  fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:302',message:'Before stats RPC',data:{hasVendorFilter:!!vendorNamesParam,hasProgramFilter:!!programReportsParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const { data: statsData, error: statsError } = await supabase.rpc('get_aop_stats', {
    p_vendor_names: vendorNamesParam,
    p_program_reports: programReportsParam,
    p_circles: circlesParam,
    p_site_categories: siteCategoriesParam,
    p_search: searchParam
  })
  // #region agent log
  const statsQueryEndTime = Date.now();
  fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:310',message:'After stats RPC',data:{duration:statsQueryEndTime-statsQueryStartTime,hasData:!!statsData,hasError:!!statsError,errorMessage:statsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!statsError && statsData && statsData.length > 0) {
    const statsRow = statsData[0]
    return {
      totalSites: Number(statsRow.total_sites) || 0,
      caf: Number(statsRow.caf_count) || 0,
      mos: Number(statsRow.mos_count) || 0,
      install: Number(statsRow.install_count) || 0,
      readiness: Number(statsRow.readiness_count) || 0,
      activated: Number(statsRow.activated_count) || 0,
      rfc: Number(statsRow.rfc_count) || 0,
      fatp: Number(statsRow.fatp_count) || 0,
      hotnews: Number(statsRow.hotnews_count) || 0,
      endorse: Number(statsRow.endorse_count) || 0,
      pac: Number(statsRow.pac_count) || 0,
      nanoClusters: Number(statsRow.cluster_count) || 0
    }
  }

  if (statsError) {
    // #region agent log
    const isTimeout = statsError.message?.includes('timeout') || statsError.message?.includes('canceling statement');
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:328',message:'Stats RPC error',data:{errorMessage:statsError.message,isTimeout},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.warn('Database function get_aop_stats failed:', statsError)
    // Don't throw - let caller use fallback calculation
  }

  return null
}

export async function GET(request: NextRequest) {
  // #region agent log
  const requestStartTime = Date.now();
  fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:342',message:'API route entry',data:{timestamp:requestStartTime,url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
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
    // #region agent log
    const dbQueryStartTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:386',message:'Before database query',data:{mode,hasCachedStats:!!cachedStats,filterHash},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // If we have cached stats, we can skip stats fetch
    let stats: SiteDataResponse['stats']
    let dataResult: { data: any[], totalCount: number }

    if (cachedStats) {
      console.log(`[AOP Site Data] Using cached stats for filter: ${filterHash}`)
      stats = cachedStats
      // Still need to fetch data
      // #region agent log
      const fetchDataStartTime = Date.now();
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:396',message:'Before fetchDataFromDatabase',data:{mode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      dataResult = await fetchDataFromDatabase(vendorNames, programReports, circles, siteCategories, q, mode)
      // #region agent log
      const fetchDataEndTime = Date.now();
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:396',message:'After fetchDataFromDatabase',data:{duration:fetchDataEndTime-fetchDataStartTime,recordCount:dataResult.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } else {
      // Fetch data and stats in parallel
      // #region agent log
      const parallelStartTime = Date.now();
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:399',message:'Before parallel fetch',data:{mode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const [fetchedData, dbStats] = await Promise.all([
        fetchDataFromDatabase(vendorNames, programReports, circles, siteCategories, q, mode),
        fetchStatsFromDatabase(vendorNames, programReports, circles, siteCategories, q)
      ])
      // #region agent log
      const parallelEndTime = Date.now();
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:399',message:'After parallel fetch',data:{duration:parallelEndTime-parallelStartTime,dataCount:fetchedData.data.length,hasStats:!!dbStats},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      dataResult = fetchedData
      // If stats RPC timeout or failed, calculate from fetched data (fallback)
      if (!dbStats) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:404',message:'Stats RPC failed, using fallback calculation',data:{recordCount:fetchedData.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
      stats = dbStats || calculateStatsFromData(dataResult.data)
      
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
    // #region agent log
    const responseSizeEstimate = JSON.stringify(responseData).length;
    const totalDuration = Date.now() - requestStartTime;
    const responseSizeMB = responseSizeEstimate / 1024 / 1024;
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:420',message:'Before response',data:{fetchTime,totalDuration,recordCount:mappedData.length,responseSizeBytes:responseSizeEstimate,responseSizeMB:responseSizeMB.toFixed(2)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Warn if response size is too large (could cause issues)
    if (responseSizeMB > 20) {
      console.warn(`[AOP Site Data] Large response size: ${responseSizeMB.toFixed(2)}MB. Consider pagination or filtering.`)
    }
    
    // Response headers (Vercel automatically compresses with gzip for large responses)
    const responseHeaders: Record<string, string> = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }

    // NOTE: We don't cache full response because data is too large (40k+ records = ~20MB)
    // Vercel KV has 256KB limit per value. We only cache stats above.

    // #region agent log
    const responseTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:431',message:'Returning success response',data:{totalDuration:responseTime-requestStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    const errorTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aop/site-data/route.ts:444',message:'Error caught',data:{errorMessage,errorStack,timeSinceStart:errorTime-requestStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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

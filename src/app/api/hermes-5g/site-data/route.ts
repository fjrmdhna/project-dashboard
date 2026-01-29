import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G } from '@/lib/supabase'
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
    hotnews: number
    endorse: number
    pac: number
    patp: number
    nanoClusters: number
  }
}

// Minimal columns for dashboard (reduces payload significantly)
// Includes fields needed by dashboard components AND client-side filtering
const MINIMAL_COLUMNS = [
  'system_key',        // Required for key
  'vendor_name',       // VendorLeaderboard + Filter
  'program_report',    // Filter
  'imp_ttp',           // Readiness/Activated cards + Filter
  'nano_cluster',      // Readiness/Activated cards + Filter
  'ran_score',         // RAN Score filter
  'year',              // Year filter
  'region',            // Region filter (deprecated)
  'region_circle',     // Circle filter
  'site_category',     // Site category filter
  'ic_000040_af',      // Install stats
  'imp_integ_af',      // Readiness - VendorLeaderboard
  'mocn_activation_forecast', // Baseline - ProgressCurve
  'rfs_bf',            // Legacy Baseline - kept for backward compatibility
  'rfs_ff',            // Forecast - ProgressCurve, VendorLeaderboard, DailyRunrate
  'rfs_af',            // Actual - ProgressCurve, ActivatedCard, VendorLeaderboard, DailyRunrate
  'caf_approved',      // CAF stats
  'mos_af',            // MOS stats
  'rfc_approved',      // RFC stats
  'hotnews_af',        // Hotnews stats
  'endorse_af',        // Endorse stats
  'pac_accepted_af',   // PAC stats
  'patp_accepted_af',  // PATP stats
  'issue_category',    // TopIssue - client-side calculation
]

// Full columns for detailed views
const FULL_COLUMNS = [
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
  'patp_accepted_af',
  'site_id',
  'site_name',
  'lat',
  'long'
]

// Get columns based on mode
const getColumns = (mode: 'full' | 'minimal' = 'full') => {
  return mode === 'minimal' ? MINIMAL_COLUMNS.join(',') : FULL_COLUMNS.join(',')
}

// Helper function to map raw data to frontend format
function mapDataToFrontend(filteredData: any[], mode: 'full' | 'minimal' = 'full'): any[] {
  if (mode === 'minimal') {
    // Minimal mapping - essential fields for dashboard + client-side filtering
    return filteredData.map(row => ({
      system_key: row.system_key,
      vendor_name: row.vendor_name || null,
      program_report: row.program_report || null,
      imp_ttp: row.imp_ttp || null,
      nano_cluster: row.nano_cluster || null,
      ran_score: row.ran_score || null,
      year: row.year || null,
      region: row.region || null,
      region_circle: row.region_circle || null,
      site_category: row.site_category || null,
      // Stats fields
      caf_approved: row.caf_approved || null,
      mos_af: row.mos_af || null,
      ic_000040_af: row.ic_000040_af || null,
      imp_integ_af: row.imp_integ_af || null,
      mocn_activation_forecast: row.mocn_activation_forecast || null,
      rfs_bf: row.rfs_bf || null,
      rfs_ff: row.rfs_ff || null,
      rfs_af: row.rfs_af || null,
      rfc_approved: row.rfc_approved || null,
      hotnews_af: row.hotnews_af || null,
      endorse_af: row.endorse_af || null,
      pac_accepted_af: row.pac_accepted_af || null,
      patp_accepted_af: row.patp_accepted_af || null,
      issue_category: row.issue_category || null,
    }))
  }
  
  // Full mapping for detailed views
  return filteredData.map(row => ({
    system_key: row.system_key,
    vendor_name: row.vendor_name,
    program_report: row.program_report,
    imp_ttp: row.imp_ttp,
    nano_cluster: row.nano_cluster,
    ran_score: row.ran_score,
    issue_category: row.issue_category,
    caf_approved: row.caf_approved || null,
    mos_af: row.mos_af || null,
    ic_000040_af: row.ic_000040_af || null,
    imp_integ_af: row.imp_integ_af || null,
    rfs_af: row.rfs_af || null,
    rfs_forecast_lock: row.rfs_forecast_lock || null,
    rfc_approved: row.rfc_approved || null,
    mocn_activation_forecast: row.mocn_activation_forecast || null,
    hotnews_af: row.hotnews_af || null,
    endorse_af: row.endorse_af || null,
    pac_accepted_af: row.pac_accepted_af || null,
    patp_accepted_af: row.patp_accepted_af || null,
    site_id: row.site_id || null,
    site_name: row.site_name || null,
    lat: row.lat || null,
    long: row.long || null
  }))
}

// Helper function to calculate stats from data (fallback)
function calculateStatsFromData(filteredData: any[]) {
  const cafCount = filteredData.filter(row => row.caf_approved).length
  const mosCount = filteredData.filter(row => row.mos_af).length
  const installCount = filteredData.filter(row => row.ic_000040_af).length
  const readinessCount = filteredData.filter(row => row.imp_integ_af).length
  const activatedCount = filteredData.filter(row => row.rfs_af).length
  const rfcCount = filteredData.filter(row => row.rfc_approved).length
  const hotnewsCount = filteredData.filter(row => row.hotnews_af).length
  const endorseCount = filteredData.filter(row => row.endorse_af).length
  const pacCount = filteredData.filter(row => row.pac_accepted_af).length
  const patpCount = filteredData.filter(row => row.patp_accepted_af).length
  const uniqueClusters = new Set<string>()
  filteredData.forEach(row => {
    if (row.nano_cluster) {
      uniqueClusters.add(row.nano_cluster)
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
    hotnews: hotnewsCount,
    endorse: endorseCount,
    pac: pacCount,
    patp: patpCount,
    nanoClusters: uniqueClusters.size
  }
}

// Fetch data from database with pagination
async function fetchDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  impTtps: string[],
  nanoClusters: string[],
  q: string,
  mode: 'full' | 'minimal' = 'full'
): Promise<{ data: any[], totalCount: number }> {
  // Use Supabase to get site data (no filters - we'll filter client-side)
  // Always fetch ALL data for client-side filtering
  const { data, count } = await getSiteData5G(
    {}, // No filters - fetch all
    {}
  )
  
  return { data: data || [], totalCount: count || 0 }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    const nanoClusters = searchParams.getAll('nano_cluster') || []
    
    // Mode: 'minimal' for dashboard (smaller payload), 'full' for detailed views
    const mode = (searchParams.get('mode') || 'minimal') as 'full' | 'minimal'

    // Create filter params for cache key
    const filterParams: FilterParams = {
      vendorNames,
      programReports,
      circles: [], // Hermes uses imp_ttp and nano_cluster, not circles
      siteCategories: [],
      ranScores: [],
      years: [],
      search: q
    }

    // Generate cache key based on filters
    const filterHash = getFilterHash(filterParams)
    const isEmpty = isEmptyFilter(filterParams)
    
    // Use different cache key for no-filter vs filtered
    const cacheKey = isEmpty 
      ? 'hermes-site-data-all'
      : `hermes-site-data-${filterHash}`
    
    // Use longer TTL for no-filter data (base data)
    const cacheTTL = isEmpty ? CACHE_TTL.FULL_DATA : CACHE_TTL.FILTERED_DATA

    // Try to get STATS from Redis cache first (full data is too large to cache)
    const statsCacheKey = `hermes-stats-${filterHash}`
    const cachedStats = await getCache<SiteDataResponse['stats']>(statsCacheKey)
    
    // We don't cache full data because it's too large (40k+ records = ~20MB)
    // Instead, we only cache stats which is small

    // Fetch from database
    console.log(`[Hermes Site Data] Fetching from database (mode: ${mode})...`)
    const startTime = Date.now()

    // If we have cached stats, we can skip stats fetch
    let stats: SiteDataResponse['stats']
    let dataResult: { data: any[], totalCount: number }

    if (cachedStats) {
      console.log(`[Hermes Site Data] Using cached stats for filter: ${filterHash}`)
      stats = cachedStats
      // Still need to fetch data
      dataResult = await fetchDataFromDatabase(vendorNames, programReports, impTtps, nanoClusters, q, mode)
    } else {
      // Fetch data (always fetch all, no filters)
      dataResult = await fetchDataFromDatabase([], [], [], [], '', mode)
      stats = calculateStatsFromData(dataResult.data)
      
      // Cache only stats (small data, ~1KB) - don't cache full data (too large ~20MB)
      setCache(statsCacheKey, stats, CACHE_TTL.STATS).catch(err => {
        console.error('[Hermes Site Data] Failed to cache stats:', err)
      })
    }

    const { data: filteredData, totalCount } = dataResult

    // Map data to frontend format with mode
    const mappedData = mapDataToFrontend(filteredData, mode)

    const fetchTime = Date.now() - startTime
    console.log(`[Hermes Site Data] Database fetch completed in ${fetchTime}ms, ${mappedData.length} records`)

    // Prepare response data (NOT cached because too large)
    const responseData: SiteDataResponse = {
      data: mappedData,
      count: mappedData.length,
      totalCount,
      stats
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
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error in Hermes site-data API route:', error)
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
          hotnews: 0,
          endorse: 0,
          pac: 0,
          patp: 0,
          nanoClusters: 0
        }
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

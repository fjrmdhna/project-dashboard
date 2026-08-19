import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G } from '@/lib/supabase'
import { normalizeRanScoreForHermesFilter } from '@/lib/hermes-ran-score-filter'
import {
  dataScopeToSiteDataFilters,
  getDataScopeCacheKey,
  parseDataScopeFromSearchParams,
} from '@/lib/hermes-dashboard-scope'
import {
  setCache,
  getFilterHash,
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
    rfa: number
    rfc: number
    fatp: number
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
  'program_report',    // Filter + RAN Score derived (normalize for display)
  'wbs_status',        // Dashboard scope filter (Active only)
  'imp_ttp',           // Readiness/Activated cards + Filter
  'nano_cluster',      // Readiness/Activated cards + Filter
  'year',              // Year filter
  'region',            // Region filter (deprecated)
  'region_circle',     // Circle filter
  'site_category',     // Site category filter
  'ic_000040_af',      // Install stats
  'imp_integ_af',      // Readiness - VendorLeaderboard
  'mocn_activation_forecast', // Baseline - ProgressCurve
  'rfs_bf',            // Legacy Baseline - kept for backward compatibility
  'rfs_ff',            // Forecast - ProgressCurve, VendorLeaderboard, DailyRunrate
  'rfs_forecast',      // Commitment readiness vendor (NR 2600 progress curve)
  'rfs_forecast_lock', // Commitment activated vendor (NR 2600 progress curve)
  'rfs_af',            // Actual - ProgressCurve, ActivatedCard, VendorLeaderboard, DailyRunrate
  'caf_approved',      // CAF stats
  'mos_af',            // MOS stats
  'ready_for_acpt_date', // RFA stats
  'rfc_approved',      // RFC stats
  'fatp_accepted_af',  // FATP stats
  'hotnews_af',        // Hotnews stats
  'endorse_af',        // Endorse stats
  'pac_accepted_af',   // PAC stats
  'patp_accepted_af',  // PATP stats
  'readiness_2600_af', // NR 2600 readiness milestone
  'activation_2600_af', // NR 2600 activation milestone
  'readiness_700_af', // NR 2600 readiness 700 milestone
  'activation_700_af', // NR 2600 activated 700 milestone
  'issue_category',    // TopIssue - client-side calculation
]

// Full columns for detailed views
const FULL_COLUMNS = [
  'system_key',
  'vendor_name',
  'program_report',
  'imp_ttp',
  'nano_cluster',
  'issue_category',
  'caf_approved',
  'mos_af',
  'ic_000040_af',
  'imp_integ_af',
  'rfs_af',
  'rfs_forecast_lock',
  'ready_for_acpt_date',
  'rfc_approved',
  'fatp_accepted_af',
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
      wbs_status: row.wbs_status || null,
      imp_ttp: row.imp_ttp || null,
      nano_cluster: row.nano_cluster || null,
      ran_score: normalizeRanScoreForHermesFilter(row.program_report ?? null),
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
      rfs_forecast: row.rfs_forecast || null,
      rfs_forecast_lock: row.rfs_forecast_lock || null,
      rfs_af: row.rfs_af || null,
      ready_for_acpt_date: row.ready_for_acpt_date || null,
      rfc_approved: row.rfc_approved || null,
      fatp_accepted_af: row.fatp_accepted_af || null,
      hotnews_af: row.hotnews_af || null,
      endorse_af: row.endorse_af || null,
      pac_accepted_af: row.pac_accepted_af || null,
      patp_accepted_af: row.patp_accepted_af || null,
      readiness_2600_af: row.readiness_2600_af || null,
      activation_2600_af: row.activation_2600_af || null,
      readiness_700_af: row.readiness_700_af || null,
      activation_700_af: row.activation_700_af || null,
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
    ran_score: normalizeRanScoreForHermesFilter(row.program_report ?? null),
    issue_category: row.issue_category,
    caf_approved: row.caf_approved || null,
    mos_af: row.mos_af || null,
    ic_000040_af: row.ic_000040_af || null,
    imp_integ_af: row.imp_integ_af || null,
    rfs_af: row.rfs_af || null,
    rfs_forecast_lock: row.rfs_forecast_lock || null,
    ready_for_acpt_date: row.ready_for_acpt_date || null,
    rfc_approved: row.rfc_approved || null,
    fatp_accepted_af: row.fatp_accepted_af || null,
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
  const rfaCount = filteredData.filter(row => row.ready_for_acpt_date).length
  const rfcCount = filteredData.filter(row => row.rfc_approved).length
  const fatpCount = filteredData.filter(row => row.fatp_accepted_af).length
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
    rfa: rfaCount,
    rfc: rfcCount,
    fatp: fatpCount,
    hotnews: hotnewsCount,
    endorse: endorseCount,
    pac: pacCount,
    patp: patpCount,
    nanoClusters: uniqueClusters.size
  }
}

// Fetch site rows from Supabase. Scoped dashboards apply program_report at DB level;
// user filters (vendor, city, etc.) remain client-side for instant filter changes.
async function fetchDataFromDatabase(
  dataScope?: ReturnType<typeof parseDataScopeFromSearchParams>
): Promise<{ data: any[], totalCount: number }> {
  const scopeFilters = dataScopeToSiteDataFilters(dataScope)
  const { data, count } = await getSiteData5G(scopeFilters, {})
  return { data: data || [], totalCount: count || 0 }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    const nanoClusters = searchParams.getAll('nano_cluster') || []
    const dataScope = parseDataScopeFromSearchParams(searchParams)
    const scopeKey = getDataScopeCacheKey(dataScope)

    // Mode: 'minimal' for dashboard (smaller payload), 'full' for detailed views
    const mode = (searchParams.get('mode') || 'minimal') as 'full' | 'minimal'

    const scopeFilters = dataScopeToSiteDataFilters(dataScope)

    // Create filter params for cache key (user filters only; scope is separate)
    const filterParams: FilterParams = {
      vendorNames,
      programReports: scopeFilters.program_report ?? [],
      circles: [],
      siteCategories: [],
      ranScores: [],
      years: [],
      search: q
    }

    const filterHash = getFilterHash(filterParams)
    const statsCacheKey = `hermes-stats-${scopeKey}-${filterHash}`

    console.log(
      `[Hermes Site Data] Fetching from database (mode: ${mode}, scope: ${scopeKey})...`
    )
    const startTime = Date.now()

    const dataResult = await fetchDataFromDatabase(dataScope)
    const stats = calculateStatsFromData(dataResult.data)

    setCache(statsCacheKey, stats, CACHE_TTL.STATS).catch(err => {
      console.error('[Hermes Site Data] Failed to cache stats:', err)
    })

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
      mode,
      scope: scopeKey
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
          rfa: 0,
          rfc: 0,
          fatp: 0,
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

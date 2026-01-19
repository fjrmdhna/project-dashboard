import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  getCache, 
  setCache, 
  getFilterHash,
  CACHE_KEYS, 
  CACHE_TTL,
  type FilterParams 
} from '@/lib/redis'

const STATUS_LABEL = {
  sow: 'SOW',
  rfi: 'RFI',
  install: 'INSTALL',
  onAir: 'ON_AIR'
} as const

type StatusLabel = typeof STATUS_LABEL[keyof typeof STATUS_LABEL]

const STATUS_COLOR_MAP: Record<StatusLabel, string> = {
  [STATUS_LABEL.onAir]: '#22C55E',
  [STATUS_LABEL.install]: '#38BDF8',
  [STATUS_LABEL.rfi]: '#FACC15',
  [STATUS_LABEL.sow]: '#F97316'
}

interface MapPoint {
  id: string
  status: StatusLabel
  lat: number
  long: number
  vendorName?: string | null
  siteName?: string | null
  siteId?: string | null
  programReport?: string | null
  impTtp?: string | null
  nanoCluster?: string | null
}

interface MapDataResponse {
  points: MapPoint[]
  counts: Record<StatusLabel, number>
  total: number
  colors: Record<StatusLabel, string>
  invalidCoordinates: number
}

const COLUMNS = [
  'system_key',
  'vendor_name',
  'program_report',
  'ic_000010_af',
  'ic_000040_af',
  'mos_af',
  'imp_integ_af',
  'rfs_af',
  'site_id',
  'site_name',
  'latitude',
  'longitude',
  'region',
  'region_circle',
  'site_category'
].join(',')

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function resolveStatus(row: any): StatusLabel {
  if (row.rfs_af) {
    return STATUS_LABEL.onAir
  }

  if (row.ic_000040_af || row.imp_integ_af) {
    return STATUS_LABEL.install
  }

  if (row.ic_000010_af) {
    return STATUS_LABEL.rfi
  }

  return STATUS_LABEL.sow
}

// Fetch data from database with pagination
async function fetchMapDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string
): Promise<any[]> {
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const pageSize = 1000
  const MAX_PAGES = 100

  // Build base query
  let baseQuery = supabase
    .from('site_data_aop')
    .select(COLUMNS, { count: 'exact' })

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
    const { data: pageData, error: pageError } = await query

    if (pageError) {
      if (pageError.code === 'PGRST116') {
        return []
      }
      throw pageError
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
    console.warn(`[AOP Map Data] Pagination safety limit reached at ${page} pages, fetched ${allData.length} records`)
  }

  return allData
}

// Process data to map points and counts
function processMapData(allData: any[], statusFilters: string[]): MapDataResponse {
  const counts: Record<StatusLabel, number> = {
    [STATUS_LABEL.onAir]: 0,
    [STATUS_LABEL.install]: 0,
    [STATUS_LABEL.rfi]: 0,
    [STATUS_LABEL.sow]: 0
  }

  const points: MapPoint[] = []
  let invalidCoordinatesCount = 0
  const uniqueSystemKeys = new Set<string>()

  for (const row of allData) {
    if (row.system_key) {
      uniqueSystemKeys.add(row.system_key)
    }

    const lat = parseCoordinate(row.latitude)
    const long = parseCoordinate(row.longitude)

    if (lat === null || long === null) {
      invalidCoordinatesCount++
      continue
    }

    const status = resolveStatus(row)

    // Apply status filter if provided
    if (statusFilters.length > 0 && !statusFilters.includes(status)) {
      continue
    }

    counts[status] += 1

    points.push({
      id: row.system_key || '',
      status,
      lat,
      long,
      vendorName: row.vendor_name ?? null,
      siteName: row.site_name ?? null,
      siteId: row.site_id ?? null,
      programReport: row.program_report ?? null,
      impTtp: row.region ?? null,
      nanoCluster: row.region_circle ?? null
    })
  }

  return {
    points,
    counts,
    total: uniqueSystemKeys.size,
    colors: STATUS_COLOR_MAP,
    invalidCoordinates: invalidCoordinatesCount
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const circles = searchParams.getAll('region_circle') || []
    const siteCategories = searchParams.getAll('site_category') || []
    const statusFilters = searchParams.getAll('status') || []

    // Create filter params for cache key (include status filters)
    const filterParams: FilterParams = {
      vendorNames,
      programReports,
      circles,
      siteCategories,
      search: q
    }

    // Generate cache key (include status filters in hash)
    const baseFilterHash = getFilterHash(filterParams)
    const statusHash = statusFilters.length > 0 ? `-${statusFilters.sort().join(',')}` : ''
    const filterHash = baseFilterHash + statusHash
    const cacheKey = CACHE_KEYS.AOP_MAP_DATA(filterHash)

    // Try to get from Redis cache first
    const cachedData = await getCache<MapDataResponse>(cacheKey)

    if (cachedData) {
      console.log(`[AOP Map Data] Returning cached data for filter: ${filterHash}`)
      return NextResponse.json({
        status: 'success',
        data: cachedData,
        timestamp: new Date().toISOString(),
        cached: true
      })
    }

    // Cache miss - fetch from database
    console.log(`[AOP Map Data] Cache miss, fetching from database...`)
    const startTime = Date.now()

    const allData = await fetchMapDataFromDatabase(
      vendorNames,
      programReports,
      circles,
      siteCategories,
      q
    )

    const responseData = processMapData(allData, statusFilters)
    const fetchTime = Date.now() - startTime

    console.log(`[AOP Map Data] Database fetch completed in ${fetchTime}ms, ${allData.length} records, ${responseData.points.length} valid points`)

    // Cache the response (don't await to not block response)
    setCache(cacheKey, responseData, CACHE_TTL.MAP_DATA).catch(err => {
      console.error('[AOP Map Data] Failed to cache response:', err)
    })

    return NextResponse.json({
      status: 'success',
      data: responseData,
      timestamp: new Date().toISOString(),
      cached: false,
      fetchTime
    })
  } catch (error) {
    console.error('Error fetching AOP map data:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch AOP map data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

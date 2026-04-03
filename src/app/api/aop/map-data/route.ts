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
  crfi: 'CRFI',
  mos: 'MOS',
  onAir: 'ON_AIR'
} as const

type StatusLabel = typeof STATUS_LABEL[keyof typeof STATUS_LABEL]

const STATUS_COLOR_MAP: Record<StatusLabel, string> = {
  [STATUS_LABEL.onAir]: '#22C55E',   // Green
  [STATUS_LABEL.mos]: '#8B5CF6',     // Purple/Violet (more distinct from green)
  [STATUS_LABEL.crfi]: '#3B82F6',    // Blue
  [STATUS_LABEL.rfi]: '#FACC15',     // Yellow
  [STATUS_LABEL.sow]: '#F97316'      // Orange
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

// Minimal columns for map display - reduces payload significantly
const MAP_COLUMNS = [
  'system_key',
  'ic_000010_af',  // RFI
  'rfi_accepted',  // CRFI
  'mos_af',        // MOS
  'rfs_af',        // ON_AIR
  'latitude',
  'longitude',
  'vendor_name',
  'site_id',
  'site_name',
  'program_report',
  'region',
  'region_circle'
].join(',')

// Filter columns - used when filters are applied
const FILTER_COLUMNS = [
  'system_key',
  'ic_000010_af',
  'rfi_accepted',
  'mos_af',
  'rfs_af',
  'latitude',
  'longitude',
  'vendor_name',
  'site_id',
  'site_name',
  'program_report',
  'region',
  'region_circle',
  'site_category',
  'ran_score',
  'pm_indosat',
  'year',
  'priority_congest_urgent'
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
  // Priority: ON_AIR > MOS > CRFI > RFI > SOW
  if (row.rfs_af) {
    return STATUS_LABEL.onAir
  }

  if (row.mos_af) {
    return STATUS_LABEL.mos
  }

  if (row.rfi_accepted) {
    return STATUS_LABEL.crfi
  }

  if (row.ic_000010_af) {
    return STATUS_LABEL.rfi
  }

  return STATUS_LABEL.sow
}

// Fetch data from database - optimized with larger batch size
async function fetchMapDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  ranScores: string[],
  pmIndosat: string[],
  years: string[],
  priorityCongestUrgent: string[],
  q: string
): Promise<any[]> {
  // Determine if we need filter columns
  const hasFilters = vendorNames.length > 0 || programReports.length > 0 || 
                     circles.length > 0 || siteCategories.length > 0 || 
                     ranScores.length > 0 ||
                     pmIndosat.length > 0 || years.length > 0 || 
                     priorityCongestUrgent.length > 0 || q.length > 0
  
  const columns = hasFilters ? FILTER_COLUMNS : MAP_COLUMNS

  // Use larger batch size to reduce round-trips
  const BATCH_SIZE = 10000
  const MAX_BATCHES = 10
  
  let allData: any[] = []
  let batch = 0

  while (batch < MAX_BATCHES) {
    const from = batch * BATCH_SIZE
    const to = from + BATCH_SIZE - 1

    // Build query for this batch
    let query = supabase
      .from('site_data_aop')
      .select(columns)
      .range(from, to)

    // Apply filters
    if (vendorNames.length > 0) {
      query = query.in('vendor_name', vendorNames)
    }

    if (programReports.length > 0) {
      query = query.in('program_report', programReports)
    }

    if (circles.length > 0) {
      const circleConditions = circles
        .map(c => `region_circle.ilike.%${c.trim().toLowerCase()}%`)
        .join(',')
      query = query.or(circleConditions)
    }

    if (siteCategories.length > 0) {
      const siteCategoryConditions = siteCategories
        .map(sc => {
          const lower = sc.toLowerCase()
          if (lower === 'new site') {
            return `site_category.ilike.%new%`
          } else if (lower === 'expansion') {
            return `site_category.ilike.%existing%,site_category.ilike.%upgrade%`
          }
          return `site_category.ilike.%${sc}%`
        })
        .join(',')
      query = query.or(siteCategoryConditions)
    }

    if (ranScores.length > 0) {
      const trimmed = ranScores.map((r) => r.trim()).filter(Boolean)
      if (trimmed.length > 0) {
        query = query.in('ran_score', trimmed)
      }
    }

    if (pmIndosat.length > 0) {
      query = query.in('pm_indosat', pmIndosat.map((p) => p.trim()).filter(Boolean))
    }

    if (years.length > 0) {
      query = query.in('year', years)
    }

    if (priorityCongestUrgent.length > 0) {
      // Use case-insensitive matching for priority_congest_urgent (ilike with OR conditions)
      const priorityConditions = priorityCongestUrgent
        .map(pcu => `priority_congest_urgent.ilike.%${pcu.trim()}%`)
        .join(',')
      query = query.or(priorityConditions)
    }

    if (q) {
      query = query.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    }

    const { data: batchData, error: batchError } = await query

    if (batchError) {
      if (batchError.code === 'PGRST116') {
        break
      }
      throw batchError
    }

    if (batchData && batchData.length > 0) {
      allData = allData.concat(batchData)
      
      // If we got less than batch size, we're done
      if (batchData.length < BATCH_SIZE) {
        break
      }
      batch++
    } else {
      break
    }
  }

  if (batch >= MAX_BATCHES) {
    console.warn(`[AOP Map Data] Batch limit reached at ${batch} batches, fetched ${allData.length} records`)
  }

  return allData
}

// Compact point format for reduced payload
interface CompactMapPoint {
  i: string   // id (system_key)
  s: number   // status (0=SOW, 1=RFI, 2=CRFI, 3=MOS, 4=ON_AIR)
  a: number   // lat
  o: number   // long
  v?: string  // vendorName
  n?: string  // siteName
  d?: string  // siteId
  p?: string  // programReport
  t?: string  // impTtp
  c?: string  // nanoCluster
}

const STATUS_TO_NUM: Record<StatusLabel, number> = {
  [STATUS_LABEL.sow]: 0,
  [STATUS_LABEL.rfi]: 1,
  [STATUS_LABEL.crfi]: 2,
  [STATUS_LABEL.mos]: 3,
  [STATUS_LABEL.onAir]: 4
}

// Process data to map points and counts - with compact format option
function processMapData(allData: any[], statusFilters: string[], compact: boolean = true): MapDataResponse | { points: CompactMapPoint[], counts: Record<StatusLabel, number>, total: number, colors: Record<StatusLabel, string>, invalidCoordinates: number, compact: true } {
  const counts: Record<StatusLabel, number> = {
    [STATUS_LABEL.onAir]: 0,
    [STATUS_LABEL.mos]: 0,
    [STATUS_LABEL.crfi]: 0,
    [STATUS_LABEL.rfi]: 0,
    [STATUS_LABEL.sow]: 0
  }

  const points: MapPoint[] = []
  const compactPoints: CompactMapPoint[] = []
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

    if (compact) {
      // Compact format - only include non-null values
      const cp: CompactMapPoint = {
        i: row.system_key || '',
        s: STATUS_TO_NUM[status],
        a: lat,
        o: long
      }
      if (row.vendor_name) cp.v = row.vendor_name
      if (row.site_name) cp.n = row.site_name
      if (row.site_id) cp.d = row.site_id
      if (row.program_report) cp.p = row.program_report
      if (row.region) cp.t = row.region
      if (row.region_circle) cp.c = row.region_circle
      compactPoints.push(cp)
    } else {
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
  }

  if (compact) {
    return {
      points: compactPoints,
      counts,
      total: uniqueSystemKeys.size,
      colors: STATUS_COLOR_MAP,
      invalidCoordinates: invalidCoordinatesCount,
      compact: true
    }
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
    const ranScores = searchParams.getAll('ran_score') || []
    const pmIndosat = searchParams.getAll('pm_indosat') || []
    const years = searchParams.getAll('year') || []
    const priorityCongestUrgent = searchParams.getAll('priority_congest_urgent') || []
    const statusFilters = searchParams.getAll('status') || []

    // Create filter params for cache key (include status filters)
    const filterParams: FilterParams = {
      vendorNames,
      programReports,
      circles,
      siteCategories,
      ranScores,
      pmIndosat,
      years,
      priorityCongestUrgent,
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
      ranScores,
      pmIndosat,
      years,
      priorityCongestUrgent,
      q
    )

    // Use compact format for better performance
    const responseData = processMapData(allData, statusFilters, true)
    const fetchTime = Date.now() - startTime

    console.log(`[AOP Map Data] Database fetch completed in ${fetchTime}ms, ${allData.length} records, ${responseData.points.length} valid points`)

    // Only cache if payload is small enough for Redis (< 200KB)
    // Vercel KV/Upstash has 256KB limit per value
    const payloadSizeForCache = JSON.stringify(responseData).length
    if (payloadSizeForCache < 200 * 1024) {
      setCache(cacheKey, responseData, CACHE_TTL.MAP_DATA).catch(err => {
        console.error('[AOP Map Data] Failed to cache response:', err)
      })
    } else {
      console.log(`[AOP Map Data] Skipping cache - payload too large: ${Math.round(payloadSizeForCache / 1024)}KB`)
    }

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

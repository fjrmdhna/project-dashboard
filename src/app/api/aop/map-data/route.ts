import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const STATUS_LABEL = {
  sow: 'SOW',
  rfi: 'RFI',
  install: 'INSTALL',  // Changed from READY to INSTALL
  onAir: 'ON_AIR'      // Changed from ACTIVE to ON_AIR
} as const

type StatusLabel = typeof STATUS_LABEL[keyof typeof STATUS_LABEL]

const STATUS_COLOR_MAP: Record<StatusLabel, string> = {
  [STATUS_LABEL.onAir]: '#22C55E',   // Hijau untuk ON_AIR
  [STATUS_LABEL.install]: '#38BDF8', // Biru untuk INSTALL
  [STATUS_LABEL.rfi]: '#FACC15',     // Kuning untuk RFI
  [STATUS_LABEL.sow]: '#F97316'      // Orange untuk SOW
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

/**
 * Resolve status for AOP data
 * Priority: ON_AIR (rfs_af) > INSTALL (ic_000040_af or imp_integ_af) > RFI (ic_000010_af) > SOW
 */
function resolveStatus(row: any): StatusLabel {
  // ON_AIR: rfs_af is filled
  if (row.rfs_af) {
    return STATUS_LABEL.onAir
  }

  // INSTALL: ic_000040_af is filled (preferred) or imp_integ_af as fallback
  // If ic_000040_af column doesn't exist in database, it will be undefined/null
  // In that case, use imp_integ_af as fallback for Install status
  if (row.ic_000040_af || row.imp_integ_af) {
    return STATUS_LABEL.install
  }

  // RFI: ic_000010_af is filled
  if (row.ic_000010_af) {
    return STATUS_LABEL.rfi
  }

  // SOW: system_key exists but no other milestones
  return STATUS_LABEL.sow
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const circles = searchParams.getAll('region_circle') || []
    const statusFilters = searchParams.getAll('status') || []

    // Select columns that exist in site_data_aop table
    // Note: ic_000040_af might not exist in database, query will handle it gracefully
    const columns = [
      'system_key',
      'vendor_name',
      'program_report',
      'ic_000010_af',  // RFI
      'ic_000040_af',  // Install (may not exist, will be null if column doesn't exist)
      'mos_af',
      'imp_integ_af',  // Fallback for Install if ic_000040_af doesn't exist
      'rfs_af',        // On-Air
      'site_id',
      'site_name',
      'latitude',
      'longitude',
      'region',
      'region_circle'
    ].join(',')

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
      baseQuery = baseQuery.in('region_circle', circles)
    }

    if (q) {
      baseQuery = baseQuery.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    }

    // Fetch all data using pagination
    let allData: any[] = []
    let hasMore = true
    let page = 0
    const pageSize = 1000

    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1

      const query = baseQuery.range(from, to)
      const { data: pageData, error: pageError } = await query

      if (pageError) {
        if (pageError.code === 'PGRST116') {
          // Table doesn't exist, return empty data
          return NextResponse.json({
            status: 'success',
            data: {
              points: [],
              counts: {
                ON_AIR: 0,
                INSTALL: 0,
                RFI: 0,
                SOW: 0
              },
              total: 0,
              colors: STATUS_COLOR_MAP,
              invalidCoordinates: 0
            },
            timestamp: new Date().toISOString()
          })
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

      // Safety check to prevent infinite loop
      if (page > 50) {
        console.warn('Pagination limit reached, stopping at page', page)
        break
      }
    }

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
      // Count unique system_key for total sites
      if (row.system_key) {
        uniqueSystemKeys.add(row.system_key)
      }

      const lat = parseCoordinate(row.latitude)
      const long = parseCoordinate(row.longitude)

      if (lat === null || long === null) {
        invalidCoordinatesCount++
        continue
      }

      // Note: ic_000040_af might not exist in database, will be null if column doesn't exist
      // In that case, resolveStatus will check for it and fall back to other statuses
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

    // Total sites = count of unique system_key
    const totalSites = uniqueSystemKeys.size

    return NextResponse.json({
      status: 'success',
      data: {
        points,
        counts,
        total: totalSites,
        colors: STATUS_COLOR_MAP,
        invalidCoordinates: invalidCoordinatesCount
      },
      timestamp: new Date().toISOString()
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


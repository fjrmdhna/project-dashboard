import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G, type SiteData5G } from '@/lib/supabase'

const STATUS_LABEL = {
  sow: 'SOW',
  rfi: 'RFI',
  ready: 'READY',
  active: 'ACTIVE'
} as const

type StatusLabel = typeof STATUS_LABEL[keyof typeof STATUS_LABEL]

const STATUS_COLOR_MAP: Record<StatusLabel, string> = {
  [STATUS_LABEL.active]: '#22C55E',  // Hijau untuk ACTIVE
  [STATUS_LABEL.ready]: '#2563EB',   // Biru untuk READY
  [STATUS_LABEL.rfi]: '#FACC15',     // Kuning untuk RFI
  [STATUS_LABEL.sow]: '#EF4444'      // Merah untuk SOW
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
  issueCategory?: string | null
  nanoCluster?: string | null
  isExcluded?: boolean
  region?: string | null
  region_circle?: string | null
  year?: string | null
  site_category?: string | null
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

function resolveStatus(row: SiteData5G): StatusLabel {
  if (row.rfs_af) {
    return STATUS_LABEL.active
  }

  if (row.imp_integ_af) {
    return STATUS_LABEL.ready
  }

  if (row.caf_approved) {
    return STATUS_LABEL.rfi
  }

  return STATUS_LABEL.sow
}

export async function GET(request: NextRequest) {
  try {
    const t0 = Date.now()
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    const nanoClusters = searchParams.getAll('nano_cluster') || []
    const regions = searchParams.getAll('region') || []
    const years = searchParams.getAll('year') || []
    const statusFilters = searchParams.getAll('status') || []

    // Single query: excluded-program query removed (logs showed excludedCount always 0; halves server time)
    const { data } = await getSiteData5G({
      vendor_name: vendorNames.length ? vendorNames : undefined,
      program_report: programReports.length ? programReports : undefined,
      imp_ttp: impTtps.length ? impTtps : undefined,
      nano_cluster: nanoClusters.length ? nanoClusters : undefined,
      region: regions.length ? regions : undefined,
      year: years.length ? years : undefined,
      search: q || undefined,
      status: statusFilters.length ? statusFilters : undefined,
      limit: 20000
    })

    const tAfterDb = Date.now()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'post-fix',
        hypothesisId: 'H1',
        location: 'src/app/api/hermes-5g/map-data/route.ts',
        message: 'map-data Supabase query completed',
        data: {
          durationMs: tAfterDb - t0,
          mainCount: data.length,
          filters: {
            vendorNamesCount: vendorNames.length,
            programReportsCount: programReports.length,
            impTtpsCount: impTtps.length,
            nanoClustersCount: nanoClusters.length,
            regionsCount: regions.length,
            yearsCount: years.length,
            statusFiltersCount: statusFilters.length
          }
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    const counts: Record<StatusLabel, number> = {
      [STATUS_LABEL.active]: 0,
      [STATUS_LABEL.ready]: 0,
      [STATUS_LABEL.rfi]: 0,
      [STATUS_LABEL.sow]: 0
    }

    const points: MapPoint[] = []
    let invalidCoordinatesCount = 0

    for (const row of data) {
      const lat = parseCoordinate(row.lat)
      const long = parseCoordinate(row.long)

      if (lat === null || long === null) {
        invalidCoordinatesCount++
        continue
      }

      const status = resolveStatus(row)
      counts[status] += 1

      points.push({
        id: row.system_key,
        status,
        lat,
        long,
        vendorName: row.vendor_name ?? null,
        siteName: row.site_name ?? null,
        siteId: row.site_id ?? null,
        programReport: row.program_report ?? null,
        impTtp: row.imp_ttp ?? null,
        issueCategory: (row as any).issue_category ?? null,
        nanoCluster: row.nano_cluster ?? null,
        region: (row as any).region ?? null,
        region_circle: (row as any).region_circle ?? null,
        year: (row as any).year ?? null,
        site_category: (row as any).site_category ?? null
      })
    }

    const durationMs = Date.now() - t0
    // Lightweight runtime evidence for map performance
    console.log('[hermes-5g/map-data] success', {
      durationMs,
      mainCount: data.length,
      points: points.length,
      invalidCoordinates: invalidCoordinatesCount
    })

    return NextResponse.json({
      status: 'success',
      data: {
        points,
        counts,
        total: points.length,
        colors: STATUS_COLOR_MAP,
        invalidCoordinates: invalidCoordinatesCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching Hermes 5G map data:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch Hermes 5G map data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    const nanoClusters = searchParams.getAll('nano_cluster') || []
    const statusFilters = searchParams.getAll('status') || []

    const { data } = await getSiteData5G({
      vendor_name: vendorNames.length ? vendorNames : undefined,
      program_report: programReports.length ? programReports : undefined,
      imp_ttp: impTtps.length ? impTtps : undefined,
      nano_cluster: nanoClusters.length ? nanoClusters : undefined,
      search: q || undefined,
      status: statusFilters.length ? statusFilters : undefined,
      limit: 20000
    })

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
        issueCategory: (row as any).issue_category ?? null
      })
    }

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


import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G, type SiteData5G } from '@/lib/supabase'
import { normalizeRanScoreForHermesFilter } from '@/lib/hermes-ran-score-filter'
import {
  HERMES_MAP_STATUS_COLORS,
  resolveHermesMapStatus,
  type HermesMapStatusLabel,
} from '@/lib/hermes-map-status'
import { dataScopeToSiteDataFilters, parseDataScopeFromSearchParams } from '@/lib/hermes-dashboard-scope'

interface MapPoint {
  id: string
  status: HermesMapStatusLabel
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
  ran_score?: string | null
}

/** Filterable row for sites with invalid coordinates (client applies same filter and counts). */
export interface InvalidCoordinateRow {
  id: string
  status: HermesMapStatusLabel
  vendorName?: string | null
  programReport?: string | null
  impTtp?: string | null
  nanoCluster?: string | null
  region?: string | null
  region_circle?: string | null
  year?: string | null
  ran_score?: string | null
  lat?: string | number | null
  long?: string | number | null
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

export async function GET(request: NextRequest) {
  try {
    const t0 = Date.now()
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const programReportMatch = searchParams.get('program_report_match')
    const impTtps = searchParams.getAll('imp_ttp') || []
    const nanoClusters = searchParams.getAll('nano_cluster') || []
    const regions = searchParams.getAll('region') || []
    const years = searchParams.getAll('year') || []
    const statusFilters = searchParams.getAll('status') || []
    const readinessColumn = searchParams.get('readiness_column') ?? undefined
    const activatedColumn = searchParams.get('activated_column') ?? undefined

    const milestoneFields =
      readinessColumn && activatedColumn
        ? { readinessColumn, activatedColumn }
        : undefined

    const dataScope = parseDataScopeFromSearchParams(searchParams)
    const scopeFilters = dataScopeToSiteDataFilters(dataScope)

    const { data } = await getSiteData5G({
      vendor_name: vendorNames.length ? vendorNames : undefined,
      program_report:
        programReports.length > 0
          ? programReports
          : scopeFilters.program_report,
      program_report_match:
        programReportMatch === 'contains'
          ? 'contains'
          : scopeFilters.program_report_match,
      wbs_status: scopeFilters.wbs_status,
      imp_ttp: impTtps.length ? impTtps : undefined,
      nano_cluster: nanoClusters.length ? nanoClusters : undefined,
      region: regions.length ? regions : undefined,
      year: years.length ? years : undefined,
      search: q || undefined,
      status: statusFilters.length ? statusFilters : undefined,
      readiness_column: readinessColumn,
      activated_column: activatedColumn,
      limit: 20000,
    })

    const counts: Record<HermesMapStatusLabel, number> = {
      ACTIVE: 0,
      READY: 0,
      RFI: 0,
      SOW: 0,
    }

    const points: MapPoint[] = []
    const invalidCoordinateRows: InvalidCoordinateRow[] = []

    for (const row of data) {
      const lat = parseCoordinate(row.lat)
      const long = parseCoordinate(row.long)
      const status = resolveHermesMapStatus(row as SiteData5G, milestoneFields)

      if (lat === null || long === null) {
        invalidCoordinateRows.push({
          id: row.system_key,
          status,
          vendorName: row.vendor_name ?? null,
          programReport: row.program_report ?? null,
          impTtp: row.imp_ttp ?? null,
          nanoCluster: row.nano_cluster ?? null,
          region: row.region ?? null,
          region_circle: row.region_circle ?? null,
          year: row.year ?? null,
          ran_score: normalizeRanScoreForHermesFilter(row.program_report ?? null),
          lat: row.lat != null ? row.lat : null,
          long: row.long != null ? row.long : null,
        })
        continue
      }

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
        issueCategory: row.issue_category ?? null,
        nanoCluster: row.nano_cluster ?? null,
        region: row.region ?? null,
        region_circle: row.region_circle ?? null,
        year: row.year ?? null,
        ran_score: normalizeRanScoreForHermesFilter(row.program_report ?? null),
      })
    }

    const durationMs = Date.now() - t0
    console.log('[hermes-5g/map-data] success', {
      durationMs,
      mainCount: data.length,
      points: points.length,
      invalidCoordinateRows: invalidCoordinateRows.length,
      scoped: programReports.length > 0,
      milestoneColumns: milestoneFields ?? 'default',
    })

    return NextResponse.json({
      status: 'success',
      data: {
        points,
        counts,
        total: points.length,
        colors: HERMES_MAP_STATUS_COLORS,
        invalidCoordinates: invalidCoordinateRows.length,
        invalidCoordinateRows,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching Hermes 5G map data:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch Hermes 5G map data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

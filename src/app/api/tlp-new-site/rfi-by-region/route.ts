import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface RegionAggregation {
  region: string
  rfi: number
  total: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const regionMap = new Map<string, { total: number; rfi: number }>()
    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from("site_data_tlp")
        .select("region, ic_000010_af, program_name, wbs_status, year, site_category, twr_owner")
        .range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        const rawRegion = row.region
        const region = hasNonEmptyValue(rawRegion) ? String(rawRegion).trim().toUpperCase() : "UNKNOWN"
        const item = regionMap.get(region) ?? { total: 0, rfi: 0 }

        item.total += 1
        if (hasNonEmptyValue(row.ic_000010_af)) {
          item.rfi += 1
        }

        regionMap.set(region, item)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const regions: RegionAggregation[] = Array.from(regionMap.entries())
      .map(([region, value]) => ({
        region,
        rfi: value.rfi,
        total: value.total,
      }))
      .sort((a, b) => b.rfi - a.rfi)

    return NextResponse.json({
      status: "success",
      data: regions,
      totalRfi: regions.reduce((sum, item) => sum + item.rfi, 0),
      totalSites: regions.reduce((sum, item) => sum + item.total, 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP New Site RFI by region",
        error: message,
      },
      { status: 500 }
    )
  }
}

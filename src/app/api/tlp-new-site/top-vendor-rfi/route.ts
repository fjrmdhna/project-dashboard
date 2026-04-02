import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface VendorAggregation {
  vendor: string
  rfi: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const vendorMap = new Map<string, number>()
    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from("site_data_tlp")
        .select("twr_owner, ic_000010_af, program_name, wbs_status, year, site_category")
        .range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        if (!hasNonEmptyValue(row.ic_000010_af)) {
          continue
        }

        const vendor = hasNonEmptyValue(row.twr_owner) ? String(row.twr_owner).trim().toUpperCase() : "UNKNOWN"
        vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + 1)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const topVendors: VendorAggregation[] = Array.from(vendorMap.entries())
      .map(([vendor, rfi]) => ({ vendor, rfi }))
      .sort((a, b) => b.rfi - a.rfi)
      .slice(0, 5)

    return NextResponse.json({
      status: "success",
      data: topVendors,
      totalRfi: topVendors.reduce((sum, item) => sum + item.rfi, 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP top vendor RFI",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

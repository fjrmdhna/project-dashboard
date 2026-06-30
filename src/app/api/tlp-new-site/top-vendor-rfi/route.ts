import { NextResponse } from "next/server"
import { applyTlpDbFilters, getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import { buildTopVendorsWithOthers, type TlpVendorPlanActual } from "@/lib/tlp-vendor-aggregation"

const TOP_N = 5

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const vendorMap = new Map<string, { plan: number; actual: number }>()
    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await applyTlpDbFilters(
        supabase
          .from("site_data_tlp")
          .select(
            "twr_owner, ic_000010_ff, ic_000010_af, program_group, program_name, project_name, wbs_status, wo_number_1, year_from_wo, site_category"
          ),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue

        const vendor = hasNonEmptyValue(row.twr_owner) ? String(row.twr_owner).trim().toUpperCase() : "UNKNOWN"
        const item = vendorMap.get(vendor) ?? { plan: 0, actual: 0 }

        if (hasNonEmptyValue(row.ic_000010_ff)) {
          item.plan += 1
        }
        if (hasNonEmptyValue(row.ic_000010_af)) {
          item.actual += 1
        }

        vendorMap.set(vendor, item)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const allVendors: TlpVendorPlanActual[] = Array.from(vendorMap.entries()).map(([vendor, counts]) => ({
      vendor,
      plan: counts.plan,
      actual: counts.actual,
    }))

    const chartVendors = buildTopVendorsWithOthers(allVendors, TOP_N)

    return NextResponse.json({
      status: "success",
      data: chartVendors,
      totalPlanRfi: allVendors.reduce((sum, item) => sum + item.plan, 0),
      totalActualRfi: allVendors.reduce((sum, item) => sum + item.actual, 0),
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

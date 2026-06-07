import { NextResponse } from "next/server"
import { applyTlpYearDbFilter, getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { normalizeTlpCircleKey, resolveTlpCircleLabel } from "@/lib/tlp-circle"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface CircleAggregation {
  circle: string
  plan: number
  actual: number
  total: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const circleMap = new Map<string, { label: string; total: number; plan: number; actual: number }>()
    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await applyTlpYearDbFilter(
        supabase
          .from("site_data_tlp")
          .select(
            "region_circle, ic_000010_ff, ic_000010_af, program_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner"
          ),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue

        const groupKey = normalizeTlpCircleKey(row.region_circle) ?? "unknown"
        const label = hasNonEmptyValue(row.region_circle)
          ? resolveTlpCircleLabel(row.region_circle)
          : "Unknown"

        const item = circleMap.get(groupKey) ?? { label, total: 0, plan: 0, actual: 0 }
        item.total += 1
        if (hasNonEmptyValue(row.ic_000010_ff)) {
          item.plan += 1
        }
        if (hasNonEmptyValue(row.ic_000010_af)) {
          item.actual += 1
        }
        circleMap.set(groupKey, item)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const circles: CircleAggregation[] = Array.from(circleMap.values())
      .map((value) => ({
        circle: value.label,
        plan: value.plan,
        actual: value.actual,
        total: value.total,
      }))
      .sort((a, b) => b.actual - a.actual)

    return NextResponse.json({
      status: "success",
      data: circles,
      totalPlanRfi: circles.reduce((sum, item) => sum + item.plan, 0),
      totalActualRfi: circles.reduce((sum, item) => sum + item.actual, 0),
      totalSites: circles.reduce((sum, item) => sum + item.total, 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP New Site RFI by circle",
        error: message,
      },
      { status: 500 }
    )
  }
}

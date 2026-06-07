import { NextResponse } from "next/server"
import { applyTlpYearDbFilter, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import {
  buildTopGapIssuesWithOthers,
  isRfiCrfiGapRow,
  resolveGapIssueCategory,
  type TlpRfiCrfiGapRow,
} from "@/lib/tlp-rfi-crfi-gap"

const TOP_N = 9

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const categoryCounts = new Map<string, number>()
    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true
    let totalGap = 0

    while (hasMore) {
      const { data, error } = await applyTlpYearDbFilter(
        supabase
          .from("site_data_tlp")
          .select(
            "ic_000010_af, rfi_accepted, issue_category, program_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner"
          ),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        if (!isRfiCrfiGapRow(row)) continue

        totalGap += 1
        const category = resolveGapIssueCategory(row.issue_category)
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const allCategories: TlpRfiCrfiGapRow[] = Array.from(categoryCounts.entries()).map(
      ([issueCategory, count]) => ({ issueCategory, count })
    )

    const chartData = buildTopGapIssuesWithOthers(allCategories, TOP_N)

    return NextResponse.json({
      status: "success",
      data: chartData,
      totalGap,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load RFI–CRFI gap by issue",
        error: message,
      },
      { status: 500 }
    )
  }
}

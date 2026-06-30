import { NextResponse } from "next/server"
import { applyTlpDbFilters, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import {
  buildTlpIssueCategoryRows,
  isCountableTlpIssueCategory,
} from "@/lib/tlp-issue-category"
import {
  parseTlpFiltersFromSearchParams,
  rowMatchesTlpFilters,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    const categoryCount: Record<string, number> = {}

    while (hasMore) {
      const { data, error } = await applyTlpDbFilters(
        supabase
          .from("site_data_tlp")
          .select("program_group, program_name, project_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner, issue_category"),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        const raw = row.issue_category
        if (!isCountableTlpIssueCategory(raw)) continue
        const key = String(raw).trim()
        categoryCount[key] = (categoryCount[key] ?? 0) + 1
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const result = buildTlpIssueCategoryRows(categoryCount)
    const filteredTotalCount = result.reduce((sum, item) => sum + item.count, 0)

    return NextResponse.json({
      status: "success",
      data: result,
      categoryCount: result.length,
      filteredTotalCount,
      totalCount: filteredTotalCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP issues",
        error: message,
      },
      { status: 500 }
    )
  }
}

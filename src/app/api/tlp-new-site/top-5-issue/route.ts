import { NextResponse } from "next/server"
import { applyTlpYearDbFilter, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import {
  parseTlpFiltersFromSearchParams,
  rowMatchesTlpFilters,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

const ISSUE_COLORS = ["#FF6B6B", "#F7B267", "#4ECDC4", "#5DA3FA", "#C792EA"] as const

function isCountableIssueCategory(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const s = String(value).trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (lower.includes("no issue")) return false
  return true
}

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
      const { data, error } = await applyTlpYearDbFilter(
        supabase
          .from("site_data_tlp")
          .select("program_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner, issue_category"),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        const raw = row.issue_category
        if (!isCountableIssueCategory(raw)) continue
        const key = String(raw).trim()
        categoryCount[key] = (categoryCount[key] ?? 0) + 1
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const sortedCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const result = sortedCategories.map(([category, count], index) => ({
      category,
      count,
      color: ISSUE_COLORS[index % ISSUE_COLORS.length],
    }))

    const filteredTotalCount = Object.values(categoryCount).reduce((sum, n) => sum + n, 0)
    const top5Count = result.reduce((sum, item) => sum + item.count, 0)

    return NextResponse.json({
      status: "success",
      data: result,
      top5Count,
      filteredTotalCount,
      totalCount: filteredTotalCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP top 5 issues",
        error: message,
      },
      { status: 500 }
    )
  }
}


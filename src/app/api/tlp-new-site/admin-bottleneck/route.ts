import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import {
  parseTlpFiltersFromSearchParams,
  rowMatchesTlpFilters,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

type AdminStatusRow = {
  program_name: string | null
  wbs_status: string | null
  year: number | string | null
  site_category: string | null
  twr_owner: string | null
  administration_status: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    const counts = new Map<string, number>()
    let total = 0

    while (hasMore) {
      const { data, error } = await supabase
        .from("site_data_tlp")
        .select("program_name, wbs_status, year, site_category, twr_owner, administration_status")
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(error.message)

      for (const row of (data ?? []) as AdminStatusRow[]) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        if (!hasNonEmptyValue(row.administration_status)) continue
        total += 1
        const key = String(row.administration_status).trim()
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const sorted = Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    const topN = 9 // show 9 + Others = 10 bars
    const top = sorted.slice(0, topN)
    const othersCount = sorted.slice(topN).reduce((sum, x) => sum + x.count, 0)
    const dataOut = othersCount > 0 ? [...top, { status: "Others", count: othersCount }] : top

    return NextResponse.json({
      status: "success",
      data: dataOut,
      total,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load administration bottleneck",
        error: message,
      },
      { status: 500 }
    )
  }
}


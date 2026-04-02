import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
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
    let totalSites = 0
    let rfi = 0
    let crfi = 0

    while (hasMore) {
      const { data, error } = await supabase
        .from("site_data_tlp")
        .select("program_name, wbs_status, year, site_category, twr_owner, ic_000010_af, rfi_accepted")
        .range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        totalSites += 1
        if (hasNonEmptyValue(row.ic_000010_af)) {
          rfi += 1
        }
        if (hasNonEmptyValue(row.rfi_accepted)) {
          crfi += 1
        }
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    return NextResponse.json({
      status: "success",
      data: { totalSites, rfi, crfi },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP New Site matrix statistics",
        error: message,
      },
      { status: 500 }
    )
  }
}

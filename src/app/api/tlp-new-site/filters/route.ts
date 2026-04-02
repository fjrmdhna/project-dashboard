import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { getCacheOrFetch } from "@/lib/redis"

type TlpFilterOptions = {
  vendors: string[]
  programs: string[]
  years: string[]
  siteCategories: string[]
  wbsStatus: string[]
  // Unused by this page but required for FilterBar-like contracts
  cities: string[]
  nanoClusters: string[]
  regions: string[]
  circles: string[]
  ranScores: string[]
  projects: string[]
  priorityCongestUrgent: string[]
  trialGbFactory: string[]
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get("refresh") === "true"

    const cacheKey = "tlp-new-site:filter-options:v1"
    const options = await getCacheOrFetch<TlpFilterOptions>(
      cacheKey + (forceRefresh ? ":refresh" : ""),
      async () => {
        const supabase = getTlpSupabaseClient()
        const pageSize = 1000
        let offset = 0
        let hasMore = true

        const vendors = new Set<string>()
        const programs = new Set<string>()
        const years = new Set<string>()
        const siteCategories = new Set<string>()
        const wbsStatus = new Set<string>()

        while (hasMore) {
          const { data, error } = await supabase
            .from("site_data_tlp")
            .select("twr_owner, program_name, year, site_category, wbs_status")
            .range(offset, offset + pageSize - 1)

          if (error) {
            throw new Error(error.message)
          }

          for (const row of data ?? []) {
            if (hasNonEmptyValue(row.twr_owner)) vendors.add(String(row.twr_owner).trim().toUpperCase())
            if (hasNonEmptyValue(row.program_name)) programs.add(String(row.program_name).trim())
            if (hasNonEmptyValue(row.year)) years.add(String(row.year).trim())
            if (hasNonEmptyValue(row.site_category)) siteCategories.add(String(row.site_category).trim())
            if (hasNonEmptyValue(row.wbs_status)) wbsStatus.add(String(row.wbs_status).trim())
          }

          hasMore = Boolean(data && data.length === pageSize)
          offset += pageSize
        }

        const toSortedArray = (s: Set<string>) => Array.from(s.values()).sort((a, b) => a.localeCompare(b))

        return {
          vendors: toSortedArray(vendors),
          programs: toSortedArray(programs),
          years: toSortedArray(years),
          siteCategories: toSortedArray(siteCategories),
          wbsStatus: toSortedArray(wbsStatus),
          cities: [],
          nanoClusters: [],
          regions: [],
          circles: [],
          ranScores: [],
          projects: [],
          priorityCongestUrgent: [],
          trialGbFactory: [],
        }
      },
      300
    )

    return NextResponse.json({
      status: "success",
      data: options,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP New Site filter options",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}


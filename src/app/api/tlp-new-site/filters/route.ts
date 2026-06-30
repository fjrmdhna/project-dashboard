import { NextResponse } from "next/server"
import { applyTlpProgramGroupScope, getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { getRowWoDerivedYear } from "@/lib/tlp-wo-number-year"
import { getCacheOrFetch } from "@/lib/redis"
import { TLP_SCOPED_PROGRAM_GROUPS } from "@/lib/tlp-program-site-category"

type TlpFilterOptions = {
  programGroups: string[]
  vendors: string[]
  projects: string[]
  years: string[]
  siteCategories: string[]
  cities: string[]
  nanoClusters: string[]
  regions: string[]
  circles: string[]
  ranScores: string[]
  priorityCongestUrgent: string[]
  trialGbFactory: string[]
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get("refresh") === "true"

    const cacheKey = "tlp-new-site:filter-options:v6"
    const options = await getCacheOrFetch<TlpFilterOptions>(
      cacheKey + (forceRefresh ? ":refresh" : ""),
      async () => {
        const supabase = getTlpSupabaseClient()
        const pageSize = 1000
        let offset = 0
        let hasMore = true

        const vendors = new Set<string>()
        const projects = new Set<string>()
        const years = new Set<string>()
        const siteCategories = new Set<string>()

        while (hasMore) {
          const { data, error } = await applyTlpProgramGroupScope(
            supabase
              .from("site_data_tlp")
              .select("twr_owner, project_name, wo_number_1, site_category")
          ).range(offset, offset + pageSize - 1)

          if (error) {
            throw new Error(error.message)
          }

          for (const row of data ?? []) {
            if (hasNonEmptyValue(row.twr_owner)) vendors.add(String(row.twr_owner).trim().toUpperCase())
            if (hasNonEmptyValue(row.project_name)) projects.add(String(row.project_name).trim())
            const woYear = getRowWoDerivedYear(row)
            if (woYear !== null) years.add(String(woYear))
            if (hasNonEmptyValue(row.site_category)) siteCategories.add(String(row.site_category).trim())
          }

          hasMore = Boolean(data && data.length === pageSize)
          offset += pageSize
        }

        const toSortedArray = (s: Set<string>) => Array.from(s.values()).sort((a, b) => a.localeCompare(b))
        const yearsSorted = Array.from(years.values()).sort((a, b) => Number(b) - Number(a))

        return {
          programGroups: [...TLP_SCOPED_PROGRAM_GROUPS],
          vendors: toSortedArray(vendors),
          projects: toSortedArray(projects),
          years: yearsSorted,
          siteCategories: toSortedArray(siteCategories),
          cities: [],
          nanoClusters: [],
          regions: [],
          circles: [],
          ranScores: [],
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

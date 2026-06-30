import { NextResponse } from "next/server"
import { applyTlpDbFilters, getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import {
  parseTlpFiltersFromSearchParams,
  rowMatchesTlpFilters,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

function normalizeTlpSiteStatus(value: unknown): string {
  if (!hasNonEmptyValue(value)) return ""
  const normalized = String(value).trim().toUpperCase()

  if (normalized.includes("PROPOSED RETURN")) return "RETURN"
  if (normalized.includes("RETURN")) return "RETURN"
  if (normalized.includes("CONSTRUCTION")) return "CONSTRUCTION"
  if (normalized.includes("SEARCHING")) return "SEARCHING"
  if (normalized.includes("SITAC")) return "SITAC"
  if (normalized.includes("CRFI")) return "CRFI"
  if (normalized.includes("SRFI")) return "RFI"
  if (normalized.includes("RFI")) return "RFI"
  if (normalized.includes("RFC")) return "RFC"

  return normalized
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true
    let totalSites = 0
    let construction = 0
    let rfc = 0
    let sitac = 0
    let searching = 0
    let returnCount = 0
    let rfi = 0
    let crfi = 0

    while (hasMore) {
      const { data, error } = await applyTlpDbFilters(
        supabase
          .from("site_data_tlp")
          .select("program_group, program_name, project_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner, site_status"),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        totalSites += 1

        const siteStatus = normalizeTlpSiteStatus(row.site_status)
        switch (siteStatus) {
          case "CRFI":
            crfi += 1
            break
          case "RFI":
            rfi += 1
            break
          case "CONSTRUCTION":
            construction += 1
            break
          case "RFC":
            rfc += 1
            break
          case "SITAC":
            sitac += 1
            break
          case "SEARCHING":
            searching += 1
            break
          case "RETURN":
            returnCount += 1
            break
          default:
            break
        }
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    return NextResponse.json({
      status: "success",
      data: { totalSites, crfi, rfi, construction, rfc, sitac, searching, returnCount },
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

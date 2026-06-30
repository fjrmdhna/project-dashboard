import { NextResponse } from "next/server"
import { applyTlpDbFilters, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import { buildRfiNotCrfiIssuePayload } from "@/lib/tlp-rfi-not-crfi-issue"
import { parseTlpFiltersFromSearchParams, rowMatchesTlpFilters, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: TlpSiteFilters = parseTlpFiltersFromSearchParams(searchParams)

    const supabase = getTlpSupabaseClient()
    const pageSize = 1000
    let offset = 0
    let hasMore = true
    const rows: Array<{
      system_key: string | null
      ic_000010_af: string | null
      rfi_accepted: string | null
      ran_vendor: string | null
      issue_category: string | null
      region_circle: string | null
      program_group: string | null
      program_name: string | null
      project_name: string | null
      wbs_status: string | null
      wo_number_1: string | null
      year_from_wo: number | null
      site_category: string | null
      twr_owner: string | null
    }> = []

    while (hasMore) {
      const { data, error } = await applyTlpDbFilters(
        supabase
          .from("site_data_tlp")
          .select(
            "system_key, ic_000010_af, rfi_accepted, ran_vendor, issue_category, region_circle, program_group, program_name, project_name, wbs_status, wo_number_1, year_from_wo, site_category, twr_owner"
          ),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      for (const row of data ?? []) {
        if (!rowMatchesTlpFilters(row, filters)) continue
        rows.push(row)
      }

      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const payload = buildRfiNotCrfiIssuePayload(rows)

    return NextResponse.json({
      status: "success",
      data: payload,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load RFI not CRFI issues",
        error: message,
      },
      { status: 500 }
    )
  }
}

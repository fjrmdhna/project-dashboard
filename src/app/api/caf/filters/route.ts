import { NextResponse } from "next/server"
import { getTlpSupabaseClient, hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { extractRfsYear } from "@/lib/caf-filters"
import { getCacheOrFetch } from "@/lib/redis"

type CafFilterOptions = {
  projects: string[]
  vendorTlp: string[]
  vendorRequestor: string[]
  cafStatus: string[]
  cafType: string[]
  avp: string[]
  year: string[]
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get("refresh") === "true"
    const cacheKey = "caf-monitoring:filter-options:v4"

    const options = await getCacheOrFetch<CafFilterOptions>(
      cacheKey + (forceRefresh ? ":refresh" : ""),
      async () => {
        const supabase = getTlpSupabaseClient()
        const pageSize = 1000
        let offset = 0
        let hasMore = true

        const projects = new Set<string>()
        const vendorTlp = new Set<string>()
        const vendorRequestor = new Set<string>()
        const cafStatus = new Set<string>()
        const cafType = new Set<string>()
        const avp = new Set<string>()
        const year = new Set<string>()

        while (hasMore) {
          const { data, error } = await supabase
            .from("site_data_caf")
            .select(
              "project_name, vendor_tlp_name, vendor_requestor_name, caf_status, caf_type, avp, rfs_af"
            )
            .range(offset, offset + pageSize - 1)

          if (error) throw new Error(error.message)

          for (const row of data ?? []) {
            if (hasNonEmptyValue(row.project_name)) projects.add(String(row.project_name).trim())
            if (hasNonEmptyValue(row.vendor_tlp_name)) vendorTlp.add(String(row.vendor_tlp_name).trim())
            if (hasNonEmptyValue(row.vendor_requestor_name)) {
              vendorRequestor.add(String(row.vendor_requestor_name).trim())
            }
            if (hasNonEmptyValue(row.caf_status)) cafStatus.add(String(row.caf_status).trim())
            if (hasNonEmptyValue(row.caf_type)) cafType.add(String(row.caf_type).trim())
            if (hasNonEmptyValue(row.avp)) avp.add(String(row.avp).trim())
            const rfsYear = extractRfsYear(row.rfs_af as string | null | undefined)
            if (rfsYear) year.add(rfsYear)
          }

          hasMore = Boolean(data && data.length === pageSize)
          offset += pageSize
        }

        const sort = (s: Set<string>) => Array.from(s.values()).sort((a, b) => a.localeCompare(b))

        const sortDesc = (s: Set<string>) =>
          Array.from(s.values()).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

        return {
          projects: sort(projects),
          vendorTlp: sort(vendorTlp),
          vendorRequestor: sort(vendorRequestor),
          cafStatus: sort(cafStatus),
          cafType: sort(cafType),
          avp: sort(avp),
          year: sortDesc(year),
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
        message: "Failed to load CAF filter options",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

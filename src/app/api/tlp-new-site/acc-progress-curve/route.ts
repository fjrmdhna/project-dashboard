import { NextResponse } from "next/server"
import { applyTlpYearDbFilter, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import {
  type AccProgressPoint,
  endOfMonth,
  formatMonthLabel,
  isPlanCcoProgram,
  monthKey,
  parseTlpDate,
  trimAccProgressPointsWithNoActivity,
} from "@/lib/tlp-acc-progress"
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
      program_name: string | null
      twr_owner: string | null
      wbs_status: string | null
      wo_number_1: string | null
      year_from_wo: number | null
      site_category: string | null
      ic_000010_ff: string | null
      ic_000010_af: string | null
      rfi_accepted: string | null
    }> = []

    while (hasMore) {
      const { data, error } = await applyTlpYearDbFilter(
        supabase
          .from("site_data_tlp")
          .select(
            "program_name, twr_owner, wbs_status, wo_number_1, year_from_wo, site_category, ic_000010_ff, ic_000010_af, rfi_accepted"
          ),
        filters
      ).range(offset, offset + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }
      rows.push(...(data ?? []))
      hasMore = Boolean(data && data.length === pageSize)
      offset += pageSize
    }

    const filteredRows = rows.filter((r) => rowMatchesTlpFilters(r, filters))

    let minY = 2099
    let minM = 11
    let maxY = 2000
    let maxM = 0
    let lastAf: Date | undefined
    let lastCr: Date | undefined

    const consider = (d: Date | undefined) => {
      if (!d) return
      const y = d.getFullYear()
      const m = d.getMonth()
      if (y < minY || (y === minY && m < minM)) {
        minY = y
        minM = m
      }
      if (y > maxY || (y === maxY && m > maxM)) {
        maxY = y
        maxM = m
      }
    }

    for (const r of filteredRows) {
      const ff = parseTlpDate(r.ic_000010_ff)
      const af = parseTlpDate(r.ic_000010_af)
      const cr = parseTlpDate(r.rfi_accepted)

      consider(ff)
      consider(af)
      consider(cr)

      if (af) {
        if (!lastAf || af.getTime() > lastAf.getTime()) lastAf = af
      }
      if (cr) {
        if (!lastCr || cr.getTime() > lastCr.getTime()) lastCr = cr
      }
    }

    if (minY > maxY) {
      const now = new Date()
      minY = now.getFullYear()
      minM = 0
      maxY = minY
      maxM = 11
    }

    const points: AccProgressPoint[] = []
    const lastAfYear = lastAf?.getFullYear()
    const lastAfMonth0 = lastAf?.getMonth()
    const lastCrYear = lastCr?.getFullYear()
    const lastCrMonth0 = lastCr?.getMonth()
    let y = minY
    let m = minM
    while (y < maxY || (y === maxY && m <= maxM)) {
      const last = endOfMonth(y, m)
      let planCcoAcc = 0
      let planRfiAcc = 0
      let actualRfiAcc = 0
      let actualCrfiAcc = 0

      for (const r of filteredRows) {
        const ff = parseTlpDate(r.ic_000010_ff)
        const af = parseTlpDate(r.ic_000010_af)
        const cr = parseTlpDate(r.rfi_accepted)

        if (ff && ff.getTime() <= last.getTime()) {
          planRfiAcc += 1
          if (isPlanCcoProgram(r.program_name)) {
            planCcoAcc += 1
          }
        }
        if (af && af.getTime() <= last.getTime()) {
          actualRfiAcc += 1
        }
        if (cr && cr.getTime() <= last.getTime()) {
          actualCrfiAcc += 1
        }
      }

      points.push({
        monthKey: monthKey(y, m),
        label: formatMonthLabel(y, m),
        planCcoAcc,
        planRfiAcc,
        actualRfiAcc:
          lastAfYear === undefined || lastAfMonth0 === undefined
            ? null
            : y > lastAfYear || (y === lastAfYear && m > lastAfMonth0)
              ? null
              : actualRfiAcc,
        actualCrfiAcc:
          lastCrYear === undefined || lastCrMonth0 === undefined
            ? null
            : y > lastCrYear || (y === lastCrYear && m > lastCrMonth0)
              ? null
              : actualCrfiAcc,
      })

      m += 1
      if (m > 11) {
        m = 0
        y += 1
      }
    }

    const data = trimAccProgressPointsWithNoActivity(points)

    return NextResponse.json({
      status: "success",
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP ACC progress curve",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

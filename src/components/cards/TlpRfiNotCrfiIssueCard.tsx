"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import {
  regionColor,
  truncateIssueLabel,
  type TlpRfiNotCrfiIssueRow,
} from "@/lib/tlp-rfi-not-crfi-issue"
import { TlpCardHeader, TlpCardHeaderTotalBadge } from "@/components/cards/tlp/TlpCardHeader"

/** Rows per page — tuned for the wallboard 1/3 bottom-right slot height. */
const ROWS_PER_PAGE = 5

const GRID_COLS = "grid-cols-[minmax(0,36%)_1fr_1.75rem]"

interface TlpRfiNotCrfiIssueCardProps {
  rows: TlpRfiNotCrfiIssueRow[]
  regions: string[]
  totalIssues: number
  skippedWithoutRanVendor?: number
  isLoading?: boolean
  error?: string | null
}

function RegionLegend({ regions }: { regions: string[] }) {
  if (regions.length === 0) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 border-t border-white/8 pt-1.5">
      {regions.map((region) => (
        <span key={region} className="inline-flex items-center gap-1 text-[8px] text-white/65">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: regionColor(region) }}
          />
          <span className="whitespace-nowrap">{region}</span>
        </span>
      ))}
    </div>
  )
}

/** Minimum segment width (px) so single-digit counts always fit inside the bar. */
function segmentMinWidthPx(value: number): number {
  if (value >= 100) return 24
  if (value >= 10) return 18
  return 13
}

function RegionStackedBar({
  regionCounts,
  regions,
}: {
  regionCounts: Record<string, number>
  regions: string[]
}) {
  const rowTotal = regions.reduce((sum, region) => sum + (regionCounts[region] ?? 0), 0)

  if (rowTotal <= 0) {
    return <div className="h-3 w-full rounded-sm bg-white/[0.04]" />
  }

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm bg-white/[0.06]">
      {regions.map((region) => {
        const value = regionCounts[region] ?? 0
        if (value <= 0) return null

        return (
          <div
            key={region}
            className="relative flex h-full min-w-0 shrink items-center justify-center overflow-hidden"
            style={{
              flex: value,
              minWidth: segmentMinWidthPx(value),
              backgroundColor: regionColor(region),
            }}
            title={`${region}: ${value.toLocaleString()}`}
          >
            <span className="pointer-events-none select-none text-[7px] font-bold leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.85)]">
              {value.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function IssueRow({
  row,
  regions,
}: {
  row: TlpRfiNotCrfiIssueRow
  regions: string[]
}) {
  return (
    <div className={`grid ${GRID_COLS} min-h-[24px] w-full items-center gap-x-1.5`}>
      <span
        className="min-w-0 truncate text-[8px] font-medium leading-tight text-white/90"
        title={row.label}
      >
        {truncateIssueLabel(row.label, 28)}
      </span>
      <RegionStackedBar regionCounts={row.regionCounts} regions={regions} />
      <span className="text-right text-[8px] font-bold tabular-nums text-white">{row.total.toLocaleString()}</span>
    </div>
  )
}

function PaginationControls({
  pageIndex,
  totalPages,
  onPrev,
  onNext,
}: {
  pageIndex: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex shrink-0 items-center gap-0.5 text-[9px] text-white/60">
      <button
        type="button"
        onClick={onPrev}
        disabled={pageIndex === 0}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums">
        {pageIndex + 1}/{totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={pageIndex >= totalPages - 1}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}

export function TlpRfiNotCrfiIssueCard({
  rows,
  regions,
  totalIssues,
  skippedWithoutRanVendor = 0,
  isLoading = false,
  error,
}: TlpRfiNotCrfiIssueCardProps) {
  const [pageIndex, setPageIndex] = useState(0)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)),
    [rows.length]
  )

  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))

  useEffect(() => {
    setPageIndex(0)
  }, [rows])

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1))
    }
  }, [pageIndex, totalPages])

  const pageRows = useMemo(() => {
    const start = safePageIndex * ROWS_PER_PAGE
    return rows.slice(start, start + ROWS_PER_PAGE)
  }, [rows, safePageIndex])

  const activeRegions = useMemo(() => {
    const used = new Set<string>()
    for (const row of pageRows) {
      for (const region of regions) {
        if ((row.regionCounts[region] ?? 0) > 0) used.add(region)
      }
    }
    return regions.filter((region) => used.has(region))
  }, [pageRows, regions])

  const hint =
    skippedWithoutRanVendor > 0
      ? `${skippedWithoutRanVendor.toLocaleString()} gap sites without ran_vendor excluded`
      : "Huawei & Nokia only • sorted by total descending"
  const showLoading = isLoading && rows.length === 0

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0F1630]/80"
      style={{ padding: "calc(var(--wb-card-padding) - 6px)" }}
      title={hint}
    >
      <TlpCardHeader
        title="RFI but Not CRFI Issue"
        icon={AlertTriangle}
        tone="amber"
        trailing={
          <>
            <TlpCardHeaderTotalBadge total={totalIssues} tone="amber" />
            <PaginationControls
              pageIndex={safePageIndex}
              totalPages={totalPages}
              onPrev={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            />
          </>
        }
      />

      {/* Body */}
      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-red-300/90">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/50">No RFI–CRFI gap issues</div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            {pageRows.map((row, index) => (
              <IssueRow
                key={`${row.label}-${safePageIndex * ROWS_PER_PAGE + index}`}
                row={row}
                regions={activeRegions}
              />
            ))}
          </div>
          <RegionLegend regions={activeRegions} />
        </>
      )}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import {
  TLP_RETURN_STATUS_COLORS,
  TLP_RETURN_STATUS_SHORT,
  TLP_RETURN_WO_RELEASED_STATUS,
  type TlpReturnStatusCounts,
  type TlpSiteReturnRow,
} from "@/lib/tlp-site-return"
import { TlpCardHeader } from "@/components/cards/tlp/TlpCardHeader"

const ROWS_PER_PAGE = 5
const GRID_COLS = "grid-cols-[2.25rem_1fr_2rem]"

interface TlpSiteReturnCardProps {
  rows: TlpSiteReturnRow[]
  statuses: string[]
  woReleasedTotal: number
  inProcessTotal: number
  grandTotal: number
  skippedWithoutStatus?: number
  isLoading?: boolean
  error?: string | null
}

function segmentMinWidthPx(value: number): number {
  if (value >= 100) return 24
  if (value >= 10) return 18
  return 13
}

function StatusLegend({ statuses }: { statuses: string[] }) {
  if (statuses.length === 0) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-white/8 pt-1.5">
      {statuses.map((status) => (
        <span key={status} className="inline-flex items-center gap-1 text-[7px] text-white/65">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
            style={{ backgroundColor: TLP_RETURN_STATUS_COLORS[status] ?? "#94A3B8" }}
          />
          <span className="whitespace-nowrap" title={status}>
            {TLP_RETURN_STATUS_SHORT[status] ?? status}
          </span>
        </span>
      ))}
    </div>
  )
}

function StatusStackedBar({
  statusCounts,
  statuses,
}: {
  statusCounts: TlpReturnStatusCounts
  statuses: string[]
}) {
  const rowTotal = statuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)

  if (rowTotal <= 0) {
    return <div className="h-3 w-full rounded-sm bg-white/[0.04]" />
  }

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm bg-white/[0.06]">
      {statuses.map((status) => {
        const value = statusCounts[status] ?? 0
        if (value <= 0) return null

        return (
          <div
            key={status}
            className="relative flex h-full min-w-0 shrink items-center justify-center overflow-hidden"
            style={{
              flex: value,
              minWidth: segmentMinWidthPx(value),
              backgroundColor: TLP_RETURN_STATUS_COLORS[status] ?? "#94A3B8",
            }}
            title={`${status}: ${value.toLocaleString()}`}
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

function RegionRow({
  row,
  statuses,
}: {
  row: TlpSiteReturnRow
  statuses: string[]
}) {
  return (
    <div className={`grid ${GRID_COLS} min-h-[24px] w-full items-center gap-x-1.5`}>
      <span className="truncate text-[8px] font-semibold text-white/88" title={row.region}>
        {row.region}
      </span>
      <StatusStackedBar statusCounts={row.statusCounts} statuses={statuses} />
      <span className="text-right text-[8px] font-bold tabular-nums text-pink-300">
        {row.woReleased.toLocaleString()}
      </span>
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

export function TlpSiteReturnCard({
  rows,
  statuses,
  woReleasedTotal,
  inProcessTotal,
  grandTotal,
  skippedWithoutStatus = 0,
  isLoading = false,
  error,
}: TlpSiteReturnCardProps) {
  const [pageIndex, setPageIndex] = useState(0)

  const activeStatuses = useMemo(() => {
    const used = new Set<string>()
    for (const row of rows) {
      for (const status of statuses) {
        if ((row.statusCounts[status] ?? 0) > 0) used.add(status)
      }
    }
    return statuses.filter((status) => used.has(status))
  }, [rows, statuses])

  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))
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

  const hint =
    skippedWithoutStatus > 0
      ? `${skippedWithoutStatus.toLocaleString()} return sites without return_replacement_status excluded`
      : "WO Return Replacement by region (sites)"
  const showLoading = isLoading && rows.length === 0

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0F1630]/80"
      style={{ padding: "calc(var(--wb-card-padding) - 6px)" }}
      title={hint}
    >
      <TlpCardHeader
        title="Site Return by Region"
        icon={RotateCcw}
        tone="pink"
        className="mb-1"
        trailing={
          <>
            <div className="rounded-md border border-white/15 bg-white/5 px-1 py-px text-[7px] text-white/70">
              <span className="font-semibold text-white">{grandTotal.toLocaleString()}</span> sites
            </div>
            <div className="rounded-md border border-pink-500/25 bg-pink-500/10 px-1 py-px text-[7px] text-white/80">
              Rel: <span className="font-bold text-pink-300">{woReleasedTotal.toLocaleString()}</span>
            </div>
            <div className="rounded-md border border-teal-500/25 bg-teal-500/10 px-1 py-px text-[7px] text-white/80">
              Proc: <span className="font-bold text-teal-300">{inProcessTotal.toLocaleString()}</span>
            </div>
            <PaginationControls
              pageIndex={safePageIndex}
              totalPages={totalPages}
              onPrev={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            />
          </>
        }
      />

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-red-300/90">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/50">No return sites</div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5">
            {pageRows.map((row) => (
              <RegionRow key={row.region} row={row} statuses={activeStatuses} />
            ))}
          </div>
          <StatusLegend statuses={activeStatuses} />
        </>
      )}
    </div>
  )
}

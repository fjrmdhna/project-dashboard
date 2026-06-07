"use client"

import { useMemo } from "react"
import { GitCompareArrows } from "lucide-react"
import type { TlpRfiCrfiGapItem } from "@/hooks/useTlpRfiCrfiGap"
import {
  sortGapChartRows,
  truncateChartLabel,
  TLP_GAP_OTHERS_LABEL,
  TLP_GAP_UNSPECIFIED_ISSUE,
} from "@/lib/tlp-rfi-crfi-gap"

const GAP_ACCENT = "#F59E0B"
const BAR_DEFAULT = "#F59E0B"
const BAR_OTHERS = "rgba(255,255,255,0.28)"
const BAR_UNSPECIFIED = "rgba(251,191,36,0.55)"
const LABEL_MAX_LEN = 22

function barColor(issueCategory: string): string {
  if (issueCategory === TLP_GAP_OTHERS_LABEL) return BAR_OTHERS
  if (issueCategory === TLP_GAP_UNSPECIFIED_ISSUE) return BAR_UNSPECIFIED
  return BAR_DEFAULT
}

function GapRow({
  row,
  rank,
  maxCount,
  totalGap,
}: {
  row: TlpRfiCrfiGapItem
  rank: number
  maxCount: number
  totalGap: number
}) {
  const widthPct = Math.max((row.count / maxCount) * 100, row.count > 0 ? 6 : 0)
  const sharePct = totalGap > 0 ? Math.round((row.count / totalGap) * 100) : 0
  const fill = barColor(row.issueCategory)
  const label = truncateChartLabel(row.issueCategory, LABEL_MAX_LEN)

  return (
    <li className="flex min-h-0 min-w-0 flex-col justify-center gap-0.5 rounded-md border border-transparent px-1 py-px transition-colors hover:border-white/5 hover:bg-white/[0.03]">
      <div className="flex min-w-0 items-center gap-1">
        <span className="w-3.5 shrink-0 text-center text-[9px] font-bold tabular-nums text-amber-400/75">
          {rank}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-white/88"
          title={row.issueCategory}
        >
          {label}
        </span>
        <span className="shrink-0 text-[10px] font-bold leading-none tabular-nums text-white">
          {row.count.toLocaleString()}
        </span>
        <span className="w-6 shrink-0 text-right text-[8px] leading-none tabular-nums text-white/40">
          {sharePct}%
        </span>
      </div>
      <div className="pl-[18px]">
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full"
            style={{ width: `${widthPct}%`, backgroundColor: fill }}
          />
        </div>
      </div>
    </li>
  )
}

export function TlpRfiCrfiGapCard({
  rows,
  totalGap,
  isLoading = false,
  error,
}: {
  rows: TlpRfiCrfiGapItem[]
  totalGap: number
  isLoading?: boolean
  error?: string | null
}) {
  const items = useMemo(() => sortGapChartRows(rows), [rows])
  const maxCount = useMemo(() => Math.max(...items.map((r) => r.count), 1), [items])
  const rowCount = Math.max(Math.ceil(items.length / 2), 1)

  return (
    <div
      className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0F1630]/80"
      style={{ padding: "calc(var(--wb-card-padding) - 6px)" }}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="shrink-0 rounded-md bg-amber-500/20 p-0.5">
            <GitCompareArrows className="h-3 w-3 text-amber-300" />
          </div>
          <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-semibold text-amber-200">
            RFI–CRFI Gap
          </span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-amber-500/10 px-1.5 py-px">
          <span className="text-[8px] text-amber-200/70">Total</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: GAP_ACCENT }}>
            {totalGap.toLocaleString()}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No gap sites</div>
      ) : (
        <ul
          className="grid min-h-0 flex-1 grid-cols-2 gap-x-2 gap-y-0 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {items.map((row, index) => (
            <GapRow key={row.issueCategory} row={row} rank={index + 1} maxCount={maxCount} totalGap={totalGap} />
          ))}
        </ul>
      )}
    </div>
  )
}

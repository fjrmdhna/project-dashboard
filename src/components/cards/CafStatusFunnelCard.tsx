"use client"

import { useMemo } from "react"
import { Filter } from "lucide-react"
import type { CafStatusFunnelItem } from "@/lib/caf-dashboard-aggregate"
import { getCafStatusShortLabel } from "@/lib/caf-status-labels"

const MAX_VISIBLE = 8

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes("reject")) return "#EF4444"
  if (s.includes("fully implemented") || s.includes("implemented")) return "#22C55E"
  if (s.includes("approve")) return "#3B82F6"
  if (s.includes("waiting")) return "#F59E0B"
  if (s.includes("not confirmed")) return "#A855F7"
  return "#60A5FA"
}

function FunnelRow({
  row,
  rank,
  maxCount,
  totalCaf,
}: {
  row: CafStatusFunnelItem
  rank: number
  maxCount: number
  totalCaf: number
}) {
  const widthPct = Math.max((row.count / maxCount) * 100, row.count > 0 ? 6 : 0)
  const sharePct = totalCaf > 0 ? Math.round((row.count / totalCaf) * 100) : 0
  const fill = statusColor(row.status)
  const shortLabel = getCafStatusShortLabel(row.status)

  return (
    <li
      className="caf-funnel-row"
      style={{
        ["--bar-width" as string]: `${widthPct}%`,
        ["--bar-color" as string]: fill,
      }}
    >
      <span className="caf-funnel-row__bar" aria-hidden="true" />
      <span className="caf-funnel-row__rank tabular-nums">{rank}</span>
      <span className="caf-funnel-row__name truncate" title={row.status}>
        {shortLabel}
      </span>
      <span className="caf-funnel-row__count tabular-nums">{row.count.toLocaleString()}</span>
      <span className="caf-funnel-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
}

export function CafStatusFunnelCard({
  items,
  totalCaf,
  isLoading = false,
  error,
}: {
  items: CafStatusFunnelItem[]
  totalCaf: number
  isLoading?: boolean
  error?: string | null
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, MAX_VISIBLE),
    [items]
  )
  const maxCount = useMemo(() => Math.max(...sorted.map((r) => r.count), 1), [sorted])
  const rowCount = Math.max(Math.ceil(sorted.length / 2), 1)

  return (
    <div className="caf-panel-card caf-panel-card-compact flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="rounded-md bg-sky-500/20 p-0.5">
            <Filter className="h-3 w-3 text-sky-300" />
          </div>
          <span className="caf-subtitle text-sky-200">CAF Status Funnel</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-sky-500/10 px-1.5 py-px">
          <span className="text-[8px] text-sky-200/70">Total</span>
          <span className="text-[11px] font-bold tabular-nums text-sky-300">
            {totalCaf.toLocaleString()}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No CAF data</div>
      ) : (
        <ul
          className="caf-funnel-list min-h-0 flex-1"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {sorted.map((row, index) => (
            <FunnelRow
              key={row.status}
              row={row}
              rank={index + 1}
              maxCount={maxCount}
              totalCaf={totalCaf}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

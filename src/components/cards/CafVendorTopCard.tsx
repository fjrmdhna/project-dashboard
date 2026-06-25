"use client"

import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import type { CafVendorLeaderboardItem } from "@/lib/caf-dashboard-aggregate"

const RANK_COLORS = ["#FACC15", "#CBD5E1", "#D97706", "#94A3B8", "#64748B"]

function VendorRow({
  item,
  rank,
  maxCount,
  totalCaf,
  barColor,
}: {
  item: CafVendorLeaderboardItem
  rank: number
  maxCount: number
  totalCaf: number
  barColor: string
}) {
  const widthPct = Math.max((item.count / maxCount) * 100, item.count > 0 ? 8 : 0)
  const sharePct = totalCaf > 0 ? Math.round((item.count / totalCaf) * 100) : 0

  return (
    <li className="caf-vendor-row" style={{ ["--bar-width" as string]: `${widthPct}%` }}>
      <span
        className="caf-vendor-row__bar"
        style={{ backgroundColor: barColor }}
        aria-hidden="true"
      />
      <span
        className="caf-vendor-row__rank tabular-nums"
        style={{ color: RANK_COLORS[rank - 1] ?? "#94A3B8" }}
      >
        {rank}
      </span>
      <span className="caf-vendor-row__name truncate" title={item.name}>
        {item.name}
      </span>
      <span className="caf-vendor-row__count tabular-nums">{item.count.toLocaleString()}</span>
      <span className="caf-vendor-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
}

export function CafVendorTopCard({
  title,
  items,
  totalCaf,
  icon: Icon,
  iconClassName,
  titleClassName,
  badgeClassName,
  barColor,
  isLoading = false,
  error,
}: {
  title: string
  items: CafVendorLeaderboardItem[]
  totalCaf: number
  icon: LucideIcon
  iconClassName: string
  titleClassName: string
  badgeClassName: string
  barColor: string
  isLoading?: boolean
  error?: string | null
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, 5),
    [items]
  )
  const maxCount = useMemo(() => Math.max(...sorted.map((item) => item.count), 1), [sorted])

  return (
    <div className="caf-panel-card caf-panel-card-compact flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className={`rounded-md p-0.5 ${iconClassName}`}>
            <Icon className="h-3 w-3" />
          </div>
          <span className={`caf-subtitle truncate ${titleClassName}`}>{title}</span>
        </div>
        <div className={`flex shrink-0 items-baseline gap-1 rounded-md px-1 py-px ${badgeClassName}`}>
          <span className="text-[7px] opacity-70">Tracked</span>
          <span className="text-[10px] font-bold tabular-nums">{totalCaf.toLocaleString()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No vendor data</div>
      ) : (
        <ul className="caf-vendor-list min-h-0 flex-1">
          {sorted.map((item, index) => (
            <VendorRow
              key={item.name}
              item={item}
              rank={index + 1}
              maxCount={maxCount}
              totalCaf={totalCaf}
              barColor={barColor}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

"use client"

import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import type { CafVendorLeaderboardItem } from "@/lib/caf-dashboard-aggregate"
import { CAF_PIPELINE_COLORS } from "@/lib/caf-status-labels"
import type { CafPipelineBucket } from "@/lib/caf-matrix-stats"

const RANK_COLORS = ["#FACC15", "#CBD5E1", "#D97706", "#94A3B8", "#64748B"]

const PIPELINE_SEGMENTS: Array<{
  key: CafPipelineBucket
  label: string
  color: string
}> = [
  { key: "implemented", label: "Impl", color: CAF_PIPELINE_COLORS.implemented },
  { key: "approved", label: "Appr", color: CAF_PIPELINE_COLORS.approved },
  { key: "inReview", label: "Review", color: CAF_PIPELINE_COLORS.inReview },
  { key: "notConfirmed", label: "N/C", color: CAF_PIPELINE_COLORS.notConfirmed },
  { key: "rejected", label: "Rej", color: CAF_PIPELINE_COLORS.rejected },
  { key: "other", label: "Other", color: CAF_PIPELINE_COLORS.other },
]

function VendorRow({
  item,
  rank,
}: {
  item: CafVendorLeaderboardItem
  rank: number
}) {
  const legend = PIPELINE_SEGMENTS.flatMap((segment) => {
    const count = item[segment.key]
    if (!count) return []
    return [`${segment.label} ${count.toLocaleString()}`]
  }).join(" · ")

  return (
    <li className="caf-vendor-row caf-vendor-row--detailed">
      <span
        className="caf-vendor-row__rank tabular-nums"
        style={{ color: RANK_COLORS[rank - 1] ?? "#94A3B8" }}
      >
        {rank}
      </span>
      <div className="caf-vendor-row__content min-w-0">
        <div className="caf-vendor-row__topline">
          <span className="caf-vendor-row__name truncate" title={item.name}>
            {item.name}
          </span>
          <span className="caf-vendor-row__count tabular-nums">{item.count.toLocaleString()}</span>
        </div>
        <div className="caf-vendor-stack" aria-hidden="true">
          {PIPELINE_SEGMENTS.map((segment) => {
            const count = item[segment.key]
            if (!count) return null
            const widthPct = Math.max((count / item.count) * 100, count > 0 ? 4 : 0)
            return (
              <span
                key={segment.key}
                className="caf-vendor-stack__segment"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: segment.color,
                }}
              />
            )
          })}
        </div>
        <p className="caf-vendor-row__legend truncate" title={legend || "No pipeline breakdown"}>
          {legend || "No pipeline breakdown"}
        </p>
      </div>
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
  barColor?: string
  isLoading?: boolean
  error?: string | null
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, 5),
    [items]
  )

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
        <ul className="caf-vendor-list caf-vendor-list--detailed min-h-0 flex-1">
          {sorted.map((item, index) => (
            <VendorRow key={item.name} item={item} rank={index + 1} />
          ))}
        </ul>
      )}
    </div>
  )
}

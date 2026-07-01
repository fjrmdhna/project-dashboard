"use client"

import { useMemo } from "react"
import { BellRing } from "lucide-react"
import type { CafNeedFollowupData } from "@/lib/caf-need-followup"
import { CAF_STATUS_DEFINITIONS } from "@/lib/caf-status-registry"

const MILESTONE_TAGS = ["RFS", "Endorse", "PATP"] as const
const AWAITING_IMPL_LABEL =
  CAF_STATUS_DEFINITIONS.find((d) => d.id === 6)?.label ?? "Approve Waiting Implementation"

function VendorRow({
  name,
  count,
  rank,
  maxCount,
  total,
}: {
  name: string
  count: number
  rank: number
  maxCount: number
  total: number
}) {
  const widthPct = Math.max((count / maxCount) * 100, count > 0 ? 6 : 0)
  const sharePct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <li
      className="caf-need-followup-row"
      style={{ ["--bar-width" as string]: `${widthPct}%` }}
    >
      <span className="caf-need-followup-row__bar" aria-hidden="true" />
      <span className="caf-need-followup-row__rank tabular-nums">{rank}</span>
      <span className="caf-need-followup-row__name truncate" title={name}>
        {name}
      </span>
      <span className="caf-need-followup-row__count tabular-nums">{count.toLocaleString()}</span>
      <span className="caf-need-followup-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
}

export function CafNeedFollowupCard({
  data,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  data: CafNeedFollowupData
  isLoading?: boolean
  error?: string | null
  layout?: "wallboard" | "mobile"
}) {
  const vendors = useMemo(() => data.vendors, [data.vendors])
  const maxCount = useMemo(() => Math.max(...vendors.map((v) => v.count), 1), [vendors])

  const stalePct =
    data.total > 0 ? Math.round((data.over30Days / data.total) * 100) : 0

  const isCompact = layout === "wallboard"

  return (
    <div className="caf-panel-card caf-panel-card-compact caf-need-followup-card flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="rounded-md bg-rose-500/20 p-0.5">
              <BellRing className="h-3 w-3 text-rose-300" />
            </div>
            <span className="caf-subtitle text-rose-200">Need Follow-up</span>
          </div>
          <p
            className={`truncate text-white/50 ${isCompact ? "text-[7px] leading-tight" : "text-[10px]"}`}
            title={`${AWAITING_IMPL_LABEL} · AF milestones complete`}
          >
            {AWAITING_IMPL_LABEL} · AF complete
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1 rounded-md bg-rose-500/10 px-1.5 py-px">
            <span className="text-[8px] text-rose-200/70">Total</span>
            <span className="text-[11px] font-bold tabular-nums text-rose-300">
              {data.total.toLocaleString()}
            </span>
          </div>
          {data.awaitingImplTotal > 0 ? (
            <span className="text-[7px] tabular-nums text-white/45">
              {data.shareOfAwaitingPct}% of {data.awaitingImplTotal.toLocaleString()} awaiting impl.
            </span>
          ) : null}
        </div>
      </div>

      <div className="caf-need-followup-milestones" aria-label="Required AF milestones (all complete)">
        {MILESTONE_TAGS.map((tag) => (
          <span key={tag} className="caf-need-followup-milestone">
            {tag}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">
          No CAF items need follow-up
        </div>
      ) : (
        <>
          <p className="caf-need-followup-section-label">Top TLP Vendor backlog</p>
          <ul className="caf-need-followup-list min-h-0 flex-1">
            {vendors.map((vendor, index) => (
              <VendorRow
                key={vendor.name}
                name={vendor.name}
                count={vendor.count}
                rank={index + 1}
                maxCount={maxCount}
                total={data.total}
              />
            ))}
          </ul>
          {data.over30Days > 0 ? (
            <footer className="caf-need-followup-footer">
              <span className="tabular-nums text-rose-300/90">{stalePct}%</span>
              <span className="text-white/45">
                {" "}
                waiting &gt;30 days ({data.over30Days.toLocaleString()})
              </span>
            </footer>
          ) : null}
        </>
      )}
    </div>
  )
}

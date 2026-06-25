"use client"

import { useMemo } from "react"
import { UserSearch } from "lucide-react"
import type { CafStatusVendorPendingItem } from "@/lib/caf-dashboard-aggregate"
import { getCafStatusColor, getCafStatusShortLabel } from "@/lib/caf-status-labels"

const MAX_VISIBLE = 6

function FollowupRow({ item }: { item: CafStatusVendorPendingItem }) {
  const shortLabel = getCafStatusShortLabel(item.status)
  const fill = getCafStatusColor(item.status)
  const vendorSummary = item.vendors
    .map((vendor) => `${vendor.name} ${vendor.count.toLocaleString()}`)
    .join(" · ")

  return (
    <li className="caf-followup-row">
      <div
        className="caf-followup-row__header"
        style={{ ["--bar-color" as string]: fill }}
      >
        <span className="caf-followup-row__status truncate" title={item.status}>
          {shortLabel}
        </span>
        <span className="caf-followup-row__count tabular-nums">{item.count.toLocaleString()}</span>
      </div>
      {vendorSummary ? (
        <p className="caf-followup-row__vendors truncate" title={vendorSummary}>
          {vendorSummary}
        </p>
      ) : (
        <p className="caf-followup-row__vendors caf-followup-row__vendors--empty">No TLP vendor assigned</p>
      )}
    </li>
  )
}

export function CafStatusVendorFollowupCard({
  items,
  pendingTotal,
  isLoading = false,
  error,
}: {
  items: CafStatusVendorPendingItem[]
  pendingTotal: number
  isLoading?: boolean
  error?: string | null
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, MAX_VISIBLE),
    [items]
  )

  return (
    <div className="caf-panel-card caf-panel-card-compact caf-followup-card flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="rounded-md bg-amber-500/20 p-0.5">
            <UserSearch className="h-3 w-3 text-amber-300" />
          </div>
          <span className="caf-subtitle text-amber-200">Status Follow-up – TLP Vendor</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-amber-500/10 px-1.5 py-px">
          <span className="text-[8px] text-amber-200/70">Pending</span>
          <span className="text-[11px] font-bold tabular-nums text-amber-300">
            {pendingTotal.toLocaleString()}
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
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">
          No pending CAF items
        </div>
      ) : (
        <ul className="caf-followup-list min-h-0 flex-1">
          {sorted.map((item) => (
            <FollowupRow key={item.status} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

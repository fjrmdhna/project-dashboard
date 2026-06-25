"use client"

import type { ReactNode } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import type { CafAgingBucket } from "@/lib/caf-status-duration"

const BUCKET_CONFIG: Array<{
  key: CafAgingBucket
  label: string
  shortLabel: string
  color: string
}> = [
  { key: "under7", label: "0–7 Days", shortLabel: "0–7d", color: "#4ADE80" },
  { key: "days8to14", label: "8–14 Days", shortLabel: "8–14d", color: "#FACC15" },
  { key: "days15to30", label: "15–30 Days", shortLabel: "15–30d", color: "#FB923C" },
  { key: "over30", label: ">30 Days", shortLabel: ">30d", color: "#F87171" },
]

function BucketChip({
  value,
  shortLabel,
  color,
}: {
  value: number
  shortLabel: string
  color: string
}) {
  return (
    <div className="caf-aging-chip">
      <span className="caf-aging-chip__value tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="caf-aging-chip__label">{shortLabel}</span>
    </div>
  )
}

function FooterStat({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode
  value: number
  label: string
  color: string
}) {
  return (
    <div className="caf-aging-footer-stat">
      <span className="shrink-0">{icon}</span>
      <span className="caf-aging-footer-stat__value tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="caf-aging-footer-stat__label">{label}</span>
    </div>
  )
}

export function CafAgingCard({
  buckets,
  waitingImplementation,
  pendingAging,
  totalOpen,
  isLoading = false,
  error,
}: {
  buckets: Record<CafAgingBucket, number>
  waitingImplementation: number
  pendingAging: number
  totalOpen: number
  isLoading?: boolean
  error?: string | null
}) {
  return (
    <div className="caf-panel-card caf-panel-card-compact caf-aging-card flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="rounded-md bg-orange-500/20 p-0.5">
            <Clock className="h-3 w-3 text-orange-300" />
          </div>
          <span className="caf-subtitle text-orange-200">CAF Aging</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 text-[9px]">
          <span className="text-white/50">Open</span>
          <span className="text-[10px] font-bold tabular-nums text-white">{totalOpen.toLocaleString()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : (
        <div className="caf-aging-body">
          <div className="grid shrink-0 grid-cols-4 gap-1">
            {BUCKET_CONFIG.map((bucket) => (
              <BucketChip
                key={bucket.key}
                value={buckets[bucket.key]}
                shortLabel={bucket.shortLabel}
                color={bucket.color}
              />
            ))}
          </div>
          <div className="caf-aging-footer grid shrink-0 grid-cols-2 gap-1">
            <FooterStat
              icon={<AlertTriangle className="h-3 w-3 text-amber-300" />}
              value={waitingImplementation}
              label="Awaiting Impl."
              color="#FBBF24"
            />
            <FooterStat
              icon={<Clock className="h-3 w-3 text-sky-300" />}
              value={pendingAging}
              label="Tracked"
              color="#38BDF8"
            />
          </div>
        </div>
      )}
    </div>
  )
}

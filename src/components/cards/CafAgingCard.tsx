"use client"

import type { ReactNode } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import type { CafAgingBucket } from "@/lib/caf-status-duration"

const BUCKET_CONFIG: Array<{
  key: CafAgingBucket
  label: string
  color: string
}> = [
  { key: "under7", label: "0–7 Days", color: "#4ADE80" },
  { key: "days8to14", label: "8–14 Days", color: "#FACC15" },
  { key: "days15to30", label: "15–30 Days", color: "#FB923C" },
  { key: "over30", label: ">30 Days", color: "#F87171" },
]

function BucketTile({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] px-2 py-2">
      <span className="text-xl font-bold leading-none tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="mt-1 text-center caf-subtitle font-medium normal-case tracking-normal text-white/70">
        {label}
      </span>
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
    <div className="flex h-full min-h-[40px] items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-base font-bold leading-none tabular-nums" style={{ color }}>
          {value.toLocaleString()}
        </div>
        <div className="mt-0.5 truncate caf-subtitle font-medium normal-case tracking-normal text-white/65">
          {label}
        </div>
      </div>
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
    <div className="caf-panel-card flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header">
        <div className="flex items-center gap-1.5">
          <div className="rounded-md bg-orange-500/20 p-0.5">
            <Clock className="h-3 w-3 text-orange-300" />
          </div>
          <span className="caf-subtitle text-orange-200">
            CAF Aging
          </span>
        </div>
        <div className="flex items-baseline gap-1 text-[9px]">
          <span className="text-white/50">Open</span>
          <span className="text-[11px] font-bold tabular-nums text-white">{totalOpen.toLocaleString()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-2">
          <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-1.5">
            {BUCKET_CONFIG.map((bucket) => (
              <BucketTile
                key={bucket.key}
                value={buckets[bucket.key]}
                label={bucket.label}
                color={bucket.color}
              />
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-1.5 border-t border-white/5 pt-1.5">
            <FooterStat
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
              value={waitingImplementation}
              label="Awaiting Implementation"
              color="#FBBF24"
            />
            <FooterStat
              icon={<Clock className="h-3.5 w-3.5 text-sky-300" />}
              value={pendingAging}
              label="Tracked Duration"
              color="#38BDF8"
            />
          </div>
        </div>
      )}
    </div>
  )
}

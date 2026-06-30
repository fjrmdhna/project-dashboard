"use client"

import { CheckCircle2, CircleDashed, Radio, ShieldCheck, Zap } from "lucide-react"
import type { CafMilestoneAlignmentData } from "@/lib/caf-milestone-fields"

const METRIC_CONFIG = [
  {
    key: "missingRfs" as const,
    label: "No RFS AF",
    shortLabel: "RFS",
    color: "#F87171",
    icon: Radio,
  },
  {
    key: "missingEndorse" as const,
    label: "No Endorse AF",
    shortLabel: "Endorse",
    color: "#FB923C",
    icon: ShieldCheck,
  },
  {
    key: "missingPatp" as const,
    label: "No PATP AF",
    shortLabel: "PATP",
    color: "#FACC15",
    icon: Zap,
  },
  {
    key: "allComplete" as const,
    label: "All Complete",
    shortLabel: "Complete",
    color: "#4ADE80",
    icon: CheckCircle2,
  },
]

function MetricTile({
  value,
  label,
  shortLabel,
  color,
  icon: Icon,
  totalCaf,
  layout = "wallboard",
}: {
  value: number
  label: string
  shortLabel: string
  color: string
  icon: typeof Radio
  totalCaf: number
  layout?: "wallboard" | "mobile"
}) {
  const sharePct = totalCaf > 0 ? Math.round((value / totalCaf) * 100) : 0
  const barWidth = totalCaf > 0 ? Math.max((value / totalCaf) * 100, value > 0 ? 6 : 0) : 0
  const isMobile = layout === "mobile"

  return (
    <div className={isMobile ? "caf-milestone-tile caf-milestone-tile--mobile" : "caf-milestone-tile"}>
      <div className="caf-milestone-tile__header">
        <span className="caf-milestone-tile__icon" style={{ color }}>
          <Icon className={isMobile ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </span>
        <span className="caf-milestone-tile__label" title={label}>
          {isMobile ? label : shortLabel}
        </span>
        <span className="caf-milestone-tile__pct tabular-nums" style={{ color }}>
          {sharePct}%
        </span>
      </div>
      <div
        className={`caf-milestone-tile__value tabular-nums ${isMobile ? "caf-milestone-tile__value--mobile" : ""}`}
        style={{ color }}
      >
        {value.toLocaleString()}
      </div>
      <div className="caf-milestone-tile__bar-track" aria-hidden="true">
        <span
          className="caf-milestone-tile__bar-fill"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function CafMilestoneAlignmentCard({
  data,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  data: CafMilestoneAlignmentData
  isLoading?: boolean
  error?: string | null
  layout?: "wallboard" | "mobile"
}) {
  const { totalCaf } = data
  const isMobile = layout === "mobile"

  return (
    <div
      className={`caf-panel-card caf-panel-card-compact caf-milestone-card flex h-full min-h-0 w-full flex-col overflow-hidden ${
        isMobile ? "caf-milestone-card--mobile" : ""
      }`}
    >
      <div className={`caf-panel-header caf-panel-header-compact ${isMobile ? "caf-panel-header--mobile" : ""}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="rounded-md bg-cyan-500/20 p-0.5">
            <CircleDashed className={`text-cyan-300 ${isMobile ? "h-3.5 w-3.5" : "h-3 w-3"}`} />
          </div>
          <span className={`caf-subtitle text-cyan-200 ${isMobile ? "text-[11px]" : ""}`}>
            AF Milestone Coverage
          </span>
        </div>
        <div className={`flex shrink-0 items-baseline gap-1 ${isMobile ? "text-[10px]" : "text-[9px]"}`}>
          <span className="text-white/50">Total</span>
          <span className={`font-bold tabular-nums text-white ${isMobile ? "text-xs" : "text-[10px]"}`}>
            {totalCaf.toLocaleString()}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">
          Loading...
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : (
        <div className="caf-milestone-body">
          <div
            className={
              isMobile
                ? "grid shrink-0 grid-cols-2 gap-2.5"
                : "grid shrink-0 grid-cols-4 gap-1.5"
            }
          >
            {METRIC_CONFIG.map((metric) => (
              <MetricTile
                key={metric.key}
                value={data[metric.key]}
                label={metric.label}
                shortLabel={metric.shortLabel}
                color={metric.color}
                icon={metric.icon}
                totalCaf={totalCaf}
                layout={layout}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

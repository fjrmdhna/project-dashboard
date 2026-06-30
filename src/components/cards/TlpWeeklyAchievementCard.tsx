"use client"

import { BarChart3 } from "lucide-react"
import { useMemo } from "react"
import {
  getYearWeekIndexForDate,
  TLP_WEEKLY_METRIC_CONFIG,
  type TlpWeeklyAchievementRow,
  type TlpWeeklyMetricCounts,
} from "@/lib/tlp-weekly-achievement"
import { TlpCardHeader } from "@/components/cards/tlp/TlpCardHeader"

interface TlpWeeklyAchievementCardProps {
  monthLabel: string
  weeks: TlpWeeklyAchievementRow[]
  mtd: TlpWeeklyMetricCounts
  isLoading?: boolean
  error?: string | null
}

const METRIC_HEADER_LABELS: Record<(typeof TLP_WEEKLY_METRIC_CONFIG)[number]["key"], string> = {
  crfi: "CRFI",
  rfi: "RFI",
  construction: "CON",
  rfc: "RFC",
  sitac: "SIT",
  searching: "SRC",
  returnCount: "RET",
}

const GRID_COLS = "grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"

function MetricCell({ value }: { value: number }) {
  return (
    <span className="text-center text-[9px] font-bold tabular-nums text-white">
      {value > 0 ? value.toLocaleString() : <span className="text-white/25">0</span>}
    </span>
  )
}

type WeekRowVariant = "default" | "current" | "mtd"

function WeekRow({
  label,
  counts,
  variant = "default",
}: {
  label: string
  counts: TlpWeeklyMetricCounts
  variant?: WeekRowVariant
}) {
  const rowClass =
    variant === "current"
      ? "rounded-sm bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/30"
      : variant === "mtd"
        ? "rounded-sm bg-white/[0.04]"
        : ""

  const labelClass =
    variant === "current"
      ? "text-cyan-300 font-bold"
      : variant === "mtd"
        ? "text-cyan-300"
        : "text-white/55"

  return (
    <div className={`grid ${GRID_COLS} min-h-0 flex-1 items-center gap-x-0.5 px-0 ${rowClass}`}>
      <span className={`truncate text-left text-[8px] font-semibold uppercase tracking-wide ${labelClass}`}>
        {label}
      </span>
      {TLP_WEEKLY_METRIC_CONFIG.map((metric) => (
        <MetricCell key={metric.key} value={counts[metric.key] ?? 0} />
      ))}
    </div>
  )
}

export function TlpWeeklyAchievementCard({
  monthLabel,
  weeks,
  mtd,
  isLoading = false,
  error,
}: TlpWeeklyAchievementCardProps) {
  const currentWeekIndex = useMemo(() => getYearWeekIndexForDate(new Date()), [])
  const showLoading = isLoading && weeks.length === 0

  return (
    <div className="matrix-compact flex h-full min-h-0 w-full min-w-0 flex-col rounded-xl border border-white/5 bg-[#0F1630]/80 p-1.5 text-white">
      <TlpCardHeader
        title="Weekly Achievement"
        icon={BarChart3}
        tone="blue"
        subtitle={monthLabel || undefined}
      />

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-red-300/90">{error}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={`grid ${GRID_COLS} shrink-0 gap-x-0.5 border-b border-white/5 pb-0.5`}
          >
            <span className="text-left text-[7px] font-medium uppercase tracking-wide text-white/40">
              Week
            </span>
            {TLP_WEEKLY_METRIC_CONFIG.map((metric) => (
              <span
                key={metric.key}
                className="text-center text-[7px] font-semibold uppercase tracking-[0.08em] text-[#90A0C4]"
                title={metric.label}
              >
                {METRIC_HEADER_LABELS[metric.key]}
              </span>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 pt-0.5">
            {weeks.map((week) => (
              <WeekRow
                key={week.label}
                label={week.label}
                counts={week.counts}
                variant={
                  week.isCurrentWeek || week.weekIndex === currentWeekIndex ? "current" : "default"
                }
              />
            ))}
            <WeekRow label="MTD" counts={mtd} variant="mtd" />
          </div>
        </div>
      )}
    </div>
  )
}

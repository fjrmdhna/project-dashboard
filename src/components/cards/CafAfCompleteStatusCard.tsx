"use client"

import { useMemo } from "react"
import { CheckCircle2 } from "lucide-react"
import type { CafAfCompleteStatusData, CafAfCompleteStatusSector } from "@/lib/caf-milestone-fields"
import { getCafStatusColor, getCafStatusShortLabel } from "@/lib/caf-status-labels"

const MILESTONE_TAGS = ["RFS", "Endorse", "PATP"] as const

function StatusRow({
  status,
  count,
  rank,
  maxCount,
  totalComplete,
}: {
  status: string
  count: number
  rank: number
  maxCount: number
  totalComplete: number
}) {
  const widthPct = Math.max((count / maxCount) * 100, count > 0 ? 6 : 0)
  const sharePct = totalComplete > 0 ? Math.round((count / totalComplete) * 100) : 0
  const fill = getCafStatusColor(status)
  const shortLabel = getCafStatusShortLabel(status)

  return (
    <li
      className="caf-af-complete-row"
      style={{
        ["--bar-width" as string]: `${widthPct}%`,
        ["--bar-color" as string]: fill,
      }}
    >
      <span className="caf-af-complete-row__bar" aria-hidden="true" />
      <span className="caf-af-complete-row__rank tabular-nums">{rank}</span>
      <span className="caf-af-complete-row__name truncate" title={status}>
        {shortLabel}
      </span>
      <span className="caf-af-complete-row__count tabular-nums">{count.toLocaleString()}</span>
      <span className="caf-af-complete-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
}

function SectorPanel({
  sector,
  maxVisible,
  accentClass,
}: {
  sector: CafAfCompleteStatusSector
  maxVisible: number
  accentClass: string
}) {
  const items = useMemo(
    () => [...sector.items].sort((a, b) => b.count - a.count).slice(0, maxVisible),
    [sector.items, maxVisible]
  )
  const maxCount = useMemo(() => Math.max(...items.map((r) => r.count), 1), [items])

  return (
    <section className={`caf-af-complete-sector ${accentClass}`} aria-label={sector.label}>
      <header className="caf-af-complete-sector__header">
        <span className="caf-af-complete-sector__label">{sector.label}</span>
        <span className="caf-af-complete-sector__total tabular-nums">
          {sector.totalComplete.toLocaleString()}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="caf-af-complete-sector__empty">No data</p>
      ) : (
        <ul className="caf-af-complete-sector__list">
          {items.map((row, index) => (
            <StatusRow
              key={row.status}
              status={row.status}
              count={row.count}
              rank={index + 1}
              maxCount={maxCount}
              totalComplete={sector.totalComplete}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function CafAfCompleteStatusCard({
  data,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  data: CafAfCompleteStatusData
  isLoading?: boolean
  error?: string | null
  layout?: "wallboard" | "mobile"
}) {
  const isWallboard = layout === "wallboard"
  const maxVisiblePerSector = isWallboard ? 4 : 6

  return (
    <div
      className={`caf-panel-card caf-panel-card-compact caf-af-complete-card flex h-full min-h-0 w-full flex-col overflow-hidden ${
        isWallboard ? "caf-af-complete-card--wallboard" : "caf-af-complete-card--mobile"
      }`}
    >
      <div className="caf-panel-header caf-panel-header-compact caf-af-complete-card__header">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className="rounded-md bg-emerald-500/20 p-0.5 shrink-0">
            <CheckCircle2 className="h-3 w-3 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className={isWallboard ? "caf-af-complete-card__title-row" : undefined}>
              <span className="caf-subtitle text-emerald-200">AF Complete — CAF Status</span>
              <div className="caf-af-complete-card__tags" aria-label="Required milestones">
                {MILESTONE_TAGS.map((tag) => (
                  <span key={tag} className="caf-af-complete-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-emerald-500/10 px-1.5 py-px">
          <span className="text-[8px] text-emerald-200/70">Complete</span>
          <span className="text-[11px] font-bold tabular-nums text-emerald-300">
            {data.totalComplete.toLocaleString()}
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
      ) : data.totalComplete === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[10px] text-white/50">
          No CAF with RFS, Endorse, and PATP complete
        </div>
      ) : (
        <div
          className={`caf-af-complete-sectors min-h-0 flex-1 ${
            isWallboard ? "caf-af-complete-sectors--wallboard" : "caf-af-complete-sectors--mobile"
          }`}
        >
          <SectorPanel
            sector={data.currentYear}
            maxVisible={maxVisiblePerSector}
            accentClass="caf-af-complete-sector--current"
          />
          <SectorPanel
            sector={data.priorYears}
            maxVisible={maxVisiblePerSector}
            accentClass="caf-af-complete-sector--prior"
          />
        </div>
      )}
    </div>
  )
}

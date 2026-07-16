"use client"

import { useMemo } from "react"
import { GitBranch } from "lucide-react"
import {
  type CafStatusBreakdown,
  type CafStatusCountItem,
} from "@/lib/caf-status-registry"

function LinearStep({
  item,
  compact = false,
}: {
  item: CafStatusCountItem
  compact?: boolean
}) {
  const { definition, count, id } = item
  const isEmpty = count === 0
  const accent = definition.color
  const label = compact ? definition.shortLabel : definition.label

  return (
    <div
      className={`caf-pipeline-step ${isEmpty ? "caf-pipeline-step--empty" : ""} ${
        compact ? "caf-pipeline-step--compact" : ""
      }`}
      role="listitem"
      style={{ ["--step-accent" as string]: accent }}
      title={`S${id} · ${definition.label}\nPIC: ${definition.picRole}`}
      aria-label={`Status ${id}, ${definition.label}, ${count.toLocaleString()} CAF`}
    >
      <span
        className="caf-pipeline-step__count tabular-nums"
        style={{ color: isEmpty ? undefined : accent }}
      >
        {count.toLocaleString()}
      </span>
      <span className="caf-pipeline-step__label">{label}</span>
    </div>
  )
}

export function CafPipelineCard({
  breakdown,
  layout = "wallboard",
}: {
  breakdown: CafStatusBreakdown
  layout?: "wallboard" | "mobile"
}) {
  const isMobile = layout === "mobile"

  const steps = useMemo(() => {
    const items = [...breakdown.byStatus]
    if (breakdown.unknown > 0) {
      items.push({
        id: 0,
        count: breakdown.unknown,
        definition: {
          id: 0,
          label: "Unmapped Status",
          shortLabel: "Unmapped",
          phase: "legacy",
          color: "#64748B",
          picRole: "—",
        },
      })
    }
    return items
  }, [breakdown])

  return (
    <div
      className={`caf-pipeline-card rounded-2xl border border-white/5 bg-[#0F1630]/85 text-white ${
        isMobile ? "caf-pipeline-card--mobile" : "caf-pipeline-card--wallboard"
      }`}
    >
      <div className={`caf-pipeline-linear ${isMobile ? "caf-pipeline-linear--mobile" : ""}`}>
        <div className="caf-pipeline-linear__lead">
          <div className="caf-pipeline-card__badge">
            <div className="rounded-md bg-blue-500/15 p-0.5">
              <GitBranch className="h-2.5 w-2.5 text-blue-300" />
            </div>
            <span className="caf-subtitle rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-200 whitespace-nowrap">
              CAF Pipeline
            </span>
          </div>

          <div className="caf-pipeline-linear__total">
            <span className="caf-pipeline-linear__total-value tabular-nums">
              {breakdown.totalCaf.toLocaleString()}
            </span>
            <span className="caf-pipeline-linear__total-label">Total CAF</span>
          </div>
        </div>

        <div className="caf-pipeline-linear__track" role="list" aria-label="CAF status workflow steps 1 to 10">
          {steps.map((item) => (
            <LinearStep key={item.id} item={item} compact={isMobile} />
          ))}
        </div>
      </div>
    </div>
  )
}

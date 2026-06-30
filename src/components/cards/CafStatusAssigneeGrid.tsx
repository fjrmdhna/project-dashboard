"use client"

import type { CafStatusAssigneeCardData } from "@/lib/caf-dashboard-aggregate"
import { CafStatusAssigneeCard } from "@/components/cards/CafStatusAssigneeCard"

export function CafStatusAssigneeGrid({
  cards,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  cards: CafStatusAssigneeCardData[]
  isLoading?: boolean
  error?: string | null
  /** `mobile` — single-column scroll stack instead of 4×2 wallboard grid */
  layout?: "wallboard" | "mobile"
}) {
  const gridClass =
    layout === "mobile"
      ? "caf-status-assignee-grid caf-status-assignee-grid--mobile"
      : "caf-status-assignee-grid"

  if (isLoading) {
    return (
      <div className={`${gridClass} caf-status-assignee-grid--state`}>
        Loading status breakdown...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${gridClass} caf-status-assignee-grid--state caf-status-assignee-grid--error`}>
        {error}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className={`${gridClass} caf-status-assignee-grid--state`}>
        No CAF status data
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {cards.map((card) => (
        <CafStatusAssigneeCard key={card.status} data={card} />
      ))}
    </div>
  )
}

"use client"

import type { CafStatusAssigneeCardData } from "@/lib/caf-dashboard-aggregate"
import { CafStatusAssigneeCard } from "@/components/cards/CafStatusAssigneeCard"

export function CafStatusAssigneeGrid({
  cards,
  isLoading = false,
  error,
}: {
  cards: CafStatusAssigneeCardData[]
  isLoading?: boolean
  error?: string | null
}) {
  if (isLoading) {
    return (
      <div className="caf-status-assignee-grid caf-status-assignee-grid--state">
        Loading status breakdown...
      </div>
    )
  }

  if (error) {
    return (
      <div className="caf-status-assignee-grid caf-status-assignee-grid--state caf-status-assignee-grid--error">
        {error}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="caf-status-assignee-grid caf-status-assignee-grid--state">
        No CAF status data
      </div>
    )
  }

  return (
    <div className="caf-status-assignee-grid">
      {cards.map((card) => (
        <CafStatusAssigneeCard key={card.status} data={card} />
      ))}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { CafStatusAssigneeCardData } from "@/lib/caf-dashboard-aggregate"
import { getCafStatusColor, getCafStatusShortLabel } from "@/lib/caf-status-labels"

const ROWS_PER_PAGE = 4

function AssigneeRow({
  rank,
  name,
  count,
  maxCount,
}: {
  rank: number
  name: string
  count: number
  maxCount: number
}) {
  const widthPct = Math.max((count / maxCount) * 100, count > 0 ? 10 : 0)

  return (
    <li
      className="caf-status-assignee-row"
      style={{ ["--bar-width" as string]: `${widthPct}%` }}
    >
      <span className="caf-status-assignee-row__rank tabular-nums">{rank}</span>
      <span className="caf-status-assignee-row__name truncate" title={name}>
        {name}
      </span>
      <span className="caf-status-assignee-row__count tabular-nums">{count.toLocaleString()}</span>
    </li>
  )
}

export function CafStatusAssigneeCard({
  data,
}: {
  data: CafStatusAssigneeCardData
}) {
  const [page, setPage] = useState(0)
  const shortLabel = getCafStatusShortLabel(data.status)
  const accent = getCafStatusColor(data.status)
  const totalPages = Math.max(1, Math.ceil(data.assignees.length / ROWS_PER_PAGE))

  useEffect(() => {
    setPage(0)
  }, [data.status, data.assignees.length])

  const pageItems = useMemo(
    () => data.assignees.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [data.assignees, page]
  )

  const maxCount = useMemo(
    () => Math.max(...data.assignees.map((item) => item.count), 1),
    [data.assignees]
  )

  const sharePct = data.count > 0 && pageItems.length > 0
    ? Math.round((pageItems.reduce((sum, item) => sum + item.count, 0) / data.count) * 100)
    : 0

  return (
    <div
      className="caf-status-assignee-card"
      style={{ ["--status-accent" as string]: accent }}
    >
      <div className="caf-status-assignee-card__header">
        <div className="min-w-0">
          <p className="caf-status-assignee-card__title truncate" title={data.status}>
            {shortLabel}
          </p>
          <p className="caf-status-assignee-card__subtitle">by {data.assigneeLabel}</p>
        </div>
        <div className="caf-status-assignee-card__badge tabular-nums">
          {data.count.toLocaleString()}
        </div>
      </div>

      {data.assignees.length === 0 ? (
        <div className="caf-status-assignee-card__empty">No assignee data</div>
      ) : (
        <>
          <ul className="caf-status-assignee-card__list">
            {pageItems.map((item, index) => (
              <AssigneeRow
                key={`${item.name}-${index}`}
                rank={page * ROWS_PER_PAGE + index + 1}
                name={item.name}
                count={item.count}
                maxCount={maxCount}
              />
            ))}
          </ul>

          <div className="caf-status-assignee-card__footer">
            <span className="caf-status-assignee-card__page-info">
              {totalPages > 1
                ? `Page ${page + 1}/${totalPages} · ${sharePct}% shown`
                : `${data.assignees.length} ${data.assigneeLabel.toLowerCase()}`}
            </span>
            {totalPages > 1 ? (
              <div className="caf-status-assignee-card__pager">
                <button
                  type="button"
                  className="caf-status-assignee-card__pager-btn"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="caf-status-assignee-card__pager-btn"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

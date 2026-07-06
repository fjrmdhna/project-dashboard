"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, UserSearch } from "lucide-react"
import { useListPagination } from "@/hooks/useListPagination"
import type { CafPicPendingData, CafPicPendingGroup, CafPicPendingItem } from "@/lib/caf-pic-pending"

const WALLBOARD_ROWS_PER_PAGE = 4
const MOBILE_ROWS_PER_PAGE = 6

function wallboardRowsPerPage(itemCount: number): number {
  if (itemCount <= 0) return 1
  return Math.min(WALLBOARD_ROWS_PER_PAGE, itemCount)
}

const AssigneeRow = memo(function AssigneeRow({
  name,
  count,
  rank,
  maxCount,
  total,
}: {
  name: string
  count: number
  rank: number
  maxCount: number
  total: number
}) {
  const widthPct = Math.max((count / maxCount) * 100, count > 0 ? 6 : 0)
  const sharePct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <li
      className="caf-pic-pending-row"
      style={{ ["--bar-width" as string]: `${widthPct}%` }}
    >
      <span className="caf-pic-pending-row__bar" aria-hidden="true" />
      <span className="caf-pic-pending-row__rank tabular-nums">{rank}</span>
      <span className="caf-pic-pending-row__name truncate" title={name}>
        {name}
      </span>
      <span className="caf-pic-pending-row__count tabular-nums">{count.toLocaleString()}</span>
      <span className="caf-pic-pending-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
})

const PicPendingGroupPanel = memo(function PicPendingGroupPanel({
  group,
  layout = "wallboard",
}: {
  group: CafPicPendingGroup
  layout?: "wallboard" | "mobile"
}) {
  const isWallboard = layout === "wallboard"
  const assignees = group.assignees
  const rowsPerPage = isWallboard ? wallboardRowsPerPage(assignees.length) : MOBILE_ROWS_PER_PAGE
  const maxCount = useMemo(
    () => Math.max(...assignees.map((a) => a.count), 1),
    [assignees]
  )
  const stalePct = group.total > 0 ? Math.round((group.over30Days / group.total) * 100) : 0

  const [page, setPage] = useState(0)
  const assigneeCountRef = useRef(assignees.length)

  useEffect(() => {
    if (assigneeCountRef.current !== assignees.length) {
      assigneeCountRef.current = assignees.length
      setPage(0)
    }
  }, [assignees.length])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const {
    page: activePage,
    pageItems,
    totalPages,
    rowsPerPage: rowsPerPageActive,
    goPrev,
    goNext,
    canPrev,
    canNext,
  } = useListPagination<CafPicPendingItem>(
    assignees,
    rowsPerPage,
    page,
    handlePageChange
  )

  const rangeStart = assignees.length === 0 ? 0 : activePage * rowsPerPageActive + 1
  const rangeEnd = Math.min((activePage + 1) * rowsPerPageActive, assignees.length)

  if (!isWallboard && group.total === 0) {
    return null
  }

  return (
    <section
      className={`caf-pic-pending-group ${isWallboard ? "caf-pic-pending-group--wallboard" : ""}${
        isWallboard && totalPages > 1 ? " caf-pic-pending-group--paginated" : ""
      }`}
      aria-label={group.statusLabel}
      style={{ ["--status-accent" as string]: group.color }}
    >
      <header className="caf-pic-pending-group__header">
        <div className="caf-pic-pending-group__title-wrap min-w-0">
          <span className="caf-pic-pending-group__title truncate" title={group.statusLabel}>
            {group.shortLabel}
          </span>
          {!isWallboard ? (
            <span className="caf-pic-pending-group__meta truncate" title={group.statusLabel}>
              {group.statusLabel}
            </span>
          ) : null}
        </div>
        <span className="caf-pic-pending-group__total tabular-nums">
          {group.total.toLocaleString()}
        </span>
      </header>

      {group.total === 0 ? (
        <p className="caf-pic-pending-group__empty">No pending</p>
      ) : (
        <>
          <p className="caf-pic-pending-group__list-label">
            {group.assigneeLabel}{" "}
            <span className="caf-pic-pending-group__assignee-count tabular-nums">
              ({assignees.length})
            </span>
          </p>

          <div className="caf-pic-pending-group__list-area">
            <ul className="caf-pic-pending-group__list" role="list">
              {pageItems.map((item, index) => (
                <AssigneeRow
                  key={item.name}
                  name={item.name}
                  count={item.count}
                  rank={activePage * rowsPerPageActive + index + 1}
                  maxCount={maxCount}
                  total={group.total}
                />
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="caf-pic-pending-group__pager">
                <span className="caf-pic-pending-group__page-info tabular-nums">
                  {rangeStart}–{rangeEnd} of {assignees.length}
                </span>
                <div className="caf-pic-pending-group__pager-controls">
                  <button
                    type="button"
                    className="caf-pic-pending-group__pager-btn"
                    onClick={goPrev}
                    disabled={!canPrev}
                    aria-label={`Previous ${group.assigneeLabel} page`}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="caf-pic-pending-group__page-num tabular-nums">
                    {activePage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="caf-pic-pending-group__pager-btn"
                    onClick={goNext}
                    disabled={!canNext}
                    aria-label={`Next ${group.assigneeLabel} page`}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {!isWallboard && group.over30Days > 0 ? (
            <footer className="caf-pic-pending-group__footer">
              <span className="tabular-nums text-amber-300/90">{stalePct}%</span>
              <span className="text-white/45">
                {" "}
                waiting &gt;30 days ({group.over30Days.toLocaleString()})
              </span>
            </footer>
          ) : null}
        </>
      )}
    </section>
  )
})

export const CafPicPendingCard = memo(function CafPicPendingCard({
  data,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  data: CafPicPendingData
  isLoading?: boolean
  error?: string | null
  layout?: "wallboard" | "mobile"
}) {
  const isWallboard = layout === "wallboard"
  const isCompact = isWallboard
  const wallboardGroups = data.groups
  const mobileGroups = data.groups.filter((group) => group.total > 0)
  const stalePct = data.total > 0 ? Math.round((data.over30Days / data.total) * 100) : 0
  const groupsToRender = isWallboard ? wallboardGroups : mobileGroups

  return (
    <div
      className={`caf-panel-card caf-panel-card-compact caf-pic-pending-card flex h-full min-h-0 w-full flex-col overflow-hidden ${
        isWallboard ? "caf-pic-pending-card--wallboard" : "caf-pic-pending-card--mobile"
      }`}
    >
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="rounded-md bg-amber-500/20 p-0.5">
              <UserSearch className="h-3 w-3 text-amber-300" />
            </div>
            <span className="caf-subtitle text-amber-200">PIC Follow-up</span>
          </div>
          <p
            className={`truncate text-white/50 ${isCompact ? "text-[7px] leading-tight" : "text-[10px]"}`}
            title="Staff · TLP review · TLP approval · AVP pending"
          >
            Staff · TLP review · TLP approval · AVP
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1 rounded-md bg-amber-500/10 px-1.5 py-px">
            <span className="text-[8px] text-amber-200/70">Pending</span>
            <span className="text-[11px] font-bold tabular-nums text-amber-300">
              {data.total.toLocaleString()}
            </span>
          </div>
          {groupsToRender.length > 0 ? (
            <span className="text-[7px] tabular-nums text-white/45">
              {isWallboard ? "4 status slots" : `${groupsToRender.length} status groups`}
            </span>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[10px] text-white/50">
          No pending CAF for PIC follow-up
        </div>
      ) : (
        <>
          <div
            className={`caf-pic-pending-groups min-h-0 flex-1 ${
              isWallboard ? "caf-pic-pending-groups--wallboard" : "caf-pic-pending-groups--mobile"
            }`}
          >
            {groupsToRender.map((group) => (
              <PicPendingGroupPanel key={group.statusId} group={group} layout={layout} />
            ))}
          </div>

          {data.over30Days > 0 ? (
            <footer className="caf-pic-pending-card__footer">
              <span className="tabular-nums text-amber-300/90">{stalePct}%</span>
              <span className="text-white/45">
                {" "}
                waiting &gt;30 days ({data.over30Days.toLocaleString()})
              </span>
            </footer>
          ) : null}
        </>
      )}
    </div>
  )
})

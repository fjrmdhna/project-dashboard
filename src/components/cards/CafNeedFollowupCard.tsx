"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react"
import { useListPagination } from "@/hooks/useListPagination"
import type {
  CafNeedFollowupData,
  CafNeedFollowupStatusGroup,
  CafNeedFollowupVendorItem,
} from "@/lib/caf-need-followup"

const MILESTONE_TAGS = ["RFS", "Endorse", "PATP"] as const

const WALLBOARD_ROWS_PER_PAGE = 4
const MOBILE_ROWS_PER_PAGE = 6

const VendorRow = memo(function VendorRow({
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
      className="caf-need-followup-row"
      style={{ ["--bar-width" as string]: `${widthPct}%` }}
    >
      <span className="caf-need-followup-row__bar" aria-hidden="true" />
      <span className="caf-need-followup-row__rank tabular-nums">{rank}</span>
      <span className="caf-need-followup-row__name truncate" title={name}>
        {name}
      </span>
      <span className="caf-need-followup-row__count tabular-nums">{count.toLocaleString()}</span>
      <span className="caf-need-followup-row__pct tabular-nums">{sharePct}%</span>
    </li>
  )
})

const StatusGroupPanel = memo(function StatusGroupPanel({
  group,
  layout = "wallboard",
  page,
  onPageChange,
}: {
  group: CafNeedFollowupStatusGroup
  layout?: "wallboard" | "mobile"
  page: number
  onPageChange: (statusId: number, page: number) => void
}) {
  const isWallboard = layout === "wallboard"
  const rowsPerPage = isWallboard ? WALLBOARD_ROWS_PER_PAGE : MOBILE_ROWS_PER_PAGE
  const vendors = useMemo(
    () => [...group.vendors].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [group.vendors]
  )
  const maxCount = useMemo(() => Math.max(...vendors.map((v) => v.count), 1), [vendors])
  const stalePct = group.total > 0 ? Math.round((group.over30Days / group.total) * 100) : 0

  const {
    page: activePage,
    pageItems,
    totalPages,
    rowsPerPage: rowsPerPageActive,
    goPrev,
    goNext,
    canPrev,
    canNext,
  } = useListPagination<CafNeedFollowupVendorItem>(
    vendors,
    rowsPerPage,
    page,
    (nextPage) => onPageChange(group.statusId, nextPage)
  )

  const rangeStart = vendors.length === 0 ? 0 : activePage * rowsPerPageActive + 1
  const rangeEnd = Math.min((activePage + 1) * rowsPerPageActive, vendors.length)

  if (group.total === 0 && group.statusTotal === 0) {
    return null
  }

  return (
    <section
      className="caf-need-followup-status-group"
      aria-label={group.label}
      style={{ ["--status-accent" as string]: group.color }}
    >
      <header className="caf-need-followup-status-group__header">
        <div className="caf-need-followup-status-group__title-wrap min-w-0">
          <span className="caf-need-followup-status-group__title truncate" title={group.label}>
            {group.shortLabel}
          </span>
          {group.statusTotal > 0 ? (
            <span className="caf-need-followup-status-group__meta tabular-nums">
              {group.shareOfStatusPct}% AF complete
            </span>
          ) : null}
        </div>
        <span className="caf-need-followup-status-group__total tabular-nums">
          {group.total.toLocaleString()}
        </span>
      </header>

      {vendors.length === 0 ? (
        <p className="caf-need-followup-status-group__empty">No vendor data</p>
      ) : (
        <div className="caf-need-followup-status-group__body">
          <p className="caf-need-followup-status-group__list-label">
            TLP Vendor{" "}
            <span className="caf-need-followup-status-group__vendor-count tabular-nums">
              ({vendors.length})
            </span>
          </p>

          <div className="caf-need-followup-status-group__list-area">
            <ul className="caf-need-followup-status-group__list">
              {pageItems.map((vendor, index) => (
                <VendorRow
                  key={vendor.name}
                  name={vendor.name}
                  count={vendor.count}
                  rank={activePage * rowsPerPageActive + index + 1}
                  maxCount={maxCount}
                  total={group.total}
                />
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="caf-need-followup-status-group__pager">
                <span className="caf-need-followup-status-group__page-info tabular-nums">
                  {rangeStart}–{rangeEnd} of {vendors.length}
                </span>
                <div className="caf-need-followup-status-group__pager-controls">
                  <button
                    type="button"
                    className="caf-need-followup-status-group__pager-btn"
                    onClick={goPrev}
                    disabled={!canPrev}
                    aria-label="Previous vendor page"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="caf-need-followup-status-group__page-num tabular-nums">
                    {activePage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="caf-need-followup-status-group__pager-btn"
                    onClick={goNext}
                    disabled={!canNext}
                    aria-label="Next vendor page"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {group.over30Days > 0 ? (
        <footer className="caf-need-followup-status-group__footer">
          <span className="tabular-nums text-rose-300/90">{stalePct}%</span>
          <span className="text-white/45">
            {" "}
            waiting &gt;30 days ({group.over30Days.toLocaleString()})
          </span>
        </footer>
      ) : null}
    </section>
  )
})

export function CafNeedFollowupCard({
  data,
  isLoading = false,
  error,
  layout = "wallboard",
}: {
  data: CafNeedFollowupData
  isLoading?: boolean
  error?: string | null
  layout?: "wallboard" | "mobile"
}) {
  const isWallboard = layout === "wallboard"
  const isCompact = isWallboard
  const visibleGroups = data.groups.filter((group) => group.total > 0 || group.statusTotal > 0)

  const [pagesByStatus, setPagesByStatus] = useState<Record<number, number>>({})
  const vendorCountsRef = useRef<Record<number, number>>({})

  useEffect(() => {
    setPagesByStatus((current) => {
      let next = current
      for (const group of data.groups) {
        const prevCount = vendorCountsRef.current[group.statusId]
        const nextCount = group.vendors.length
        if (prevCount !== undefined && prevCount !== nextCount) {
          if (next === current) next = { ...current }
          next[group.statusId] = 0
        }
        vendorCountsRef.current[group.statusId] = nextCount
      }
      return next
    })
  }, [data.groups])

  const setPageForStatus = useCallback((statusId: number, page: number) => {
    setPagesByStatus((current) => ({ ...current, [statusId]: page }))
  }, [])

  return (
    <div className="caf-panel-card caf-panel-card-compact caf-need-followup-card flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="caf-panel-header caf-panel-header-compact">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="rounded-md bg-rose-500/20 p-0.5">
              <BellRing className="h-3 w-3 text-rose-300" />
            </div>
            <span className="caf-subtitle text-rose-200">Need Follow-up</span>
            <span className="caf-need-followup-year-badge tabular-nums">{data.splitYear}</span>
          </div>
          <p
            className={`truncate text-white/50 ${isCompact ? "text-[7px] leading-tight" : "text-[10px]"}`}
            title="2026 RFS AF · implementation statuses · AF milestones complete"
          >
            RFS {data.splitYear} · Await Impl · TLP Final · Done
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1 rounded-md bg-rose-500/10 px-1.5 py-px">
            <span className="text-[8px] text-rose-200/70">Total</span>
            <span className="text-[11px] font-bold tabular-nums text-rose-300">
              {data.total.toLocaleString()}
            </span>
          </div>
          {data.statusTotal > 0 ? (
            <span className="text-[7px] tabular-nums text-white/45">
              {data.shareOfStatusPct}% of {data.statusTotal.toLocaleString()} in scope
            </span>
          ) : null}
        </div>
      </div>

      <div className="caf-need-followup-milestones" aria-label="Required AF milestones (all complete)">
        {MILESTONE_TAGS.map((tag) => (
          <span key={tag} className="caf-need-followup-milestone">
            {tag}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">
          No CAF items need follow-up for {data.splitYear}
        </div>
      ) : (
        <div
          className={`caf-need-followup-groups min-h-0 flex-1 ${
            isWallboard ? "caf-need-followup-groups--wallboard" : "caf-need-followup-groups--mobile"
          }`}
        >
          {visibleGroups.map((group) => (
            <StatusGroupPanel
              key={group.statusId}
              group={group}
              layout={layout}
              page={pagesByStatus[group.statusId] ?? 0}
              onPageChange={setPageForStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

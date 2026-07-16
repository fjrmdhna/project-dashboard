"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react"
import { useListPagination } from "@/hooks/useListPagination"
import { useWallboardRowsPerPage } from "@/hooks/useWallboardRowsPerPage"
import type {
  CafNeedFollowupData,
  CafNeedFollowupStatusGroup,
  CafNeedFollowupVendorItem,
} from "@/lib/caf-need-followup"

const MILESTONE_TAGS = ["RFS", "Endorse", "PATP"] as const

const MOBILE_ROWS_PER_PAGE = 5

function resolveRowsPerPage(
  isWallboard: boolean,
  itemCount: number,
  measuredWallboardRows: number
): number {
  if (itemCount <= 0) return 1
  if (!isWallboard) return MOBILE_ROWS_PER_PAGE
  return Math.min(measuredWallboardRows, itemCount)
}

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
  wallboardRowsPerPage = 2,
}: {
  group: CafNeedFollowupStatusGroup
  layout?: "wallboard" | "mobile"
  wallboardRowsPerPage?: number
}) {
  const isWallboard = layout === "wallboard"
  const vendors = useMemo(
    () => [...group.vendors].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [group.vendors]
  )
  const rowsPerPage = resolveRowsPerPage(isWallboard, vendors.length, wallboardRowsPerPage)
  const maxCount = useMemo(() => Math.max(...vendors.map((v) => v.count), 1), [vendors])
  const stalePct = group.total > 0 ? Math.round((group.over30Days / group.total) * 100) : 0

  const [page, setPage] = useState(0)
  const vendorCountRef = useRef(vendors.length)
  const rowsPerPageRef = useRef(rowsPerPage)

  useEffect(() => {
    if (vendorCountRef.current !== vendors.length) {
      vendorCountRef.current = vendors.length
      setPage(0)
    }
  }, [vendors.length])

  useEffect(() => {
    if (rowsPerPageRef.current !== rowsPerPage) {
      rowsPerPageRef.current = rowsPerPage
      setPage(0)
    }
  }, [rowsPerPage])

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
  } = useListPagination<CafNeedFollowupVendorItem>(
    vendors,
    rowsPerPage,
    page,
    handlePageChange
  )

  const rangeStart = vendors.length === 0 ? 0 : activePage * rowsPerPageActive + 1
  const rangeEnd = Math.min((activePage + 1) * rowsPerPageActive, vendors.length)

  if (group.total === 0 && group.statusTotal === 0) {
    return null
  }

  return (
    <section
      className={`caf-need-followup-status-group${
        isWallboard
          ? " caf-need-followup-status-group--wallboard"
          : " caf-need-followup-status-group--mobile"
      }${isWallboard && totalPages > 1 ? " caf-need-followup-status-group--paginated" : ""}`}
      aria-label={group.label}
      style={{ ["--status-accent" as string]: group.color }}
    >
      <header className="caf-need-followup-status-group__header">
        <div className="caf-need-followup-status-group__title-wrap min-w-0">
          <span className="caf-need-followup-status-group__title truncate" title={group.label}>
            {group.shortLabel}
          </span>
          {!isWallboard ? (
            <span className="caf-need-followup-status-group__meta truncate">
              TLP Vendor · {vendors.length}
              {group.statusTotal > 0 ? ` · ${group.shareOfStatusPct}% AF` : ""}
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
          {isWallboard ? (
            <p className="caf-need-followup-status-group__list-label">
              TLP Vendor{" "}
              <span className="caf-need-followup-status-group__vendor-count tabular-nums">
                ({vendors.length})
              </span>
            </p>
          ) : null}

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

      {!isWallboard && group.over30Days > 0 ? (
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

export const CafNeedFollowupCard = memo(function CafNeedFollowupCard({
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
  const wallboardGroups = data.groups.filter((group) => group.total > 0 || group.statusTotal > 0)
  const mobileGroups = data.groups.filter((group) => group.total > 0)
  const visibleGroups = isWallboard ? wallboardGroups : mobileGroups
  const groupsRef = useRef<HTMLDivElement>(null)
  const measuredWallboardRows = useWallboardRowsPerPage(
    groupsRef,
    visibleGroups.length,
    isWallboard && !isLoading && !error && data.total > 0
  )

  return (
    <div
      className={`caf-panel-card caf-panel-card-compact caf-need-followup-card flex w-full flex-col ${
        isWallboard
          ? "caf-need-followup-card--wallboard h-full min-h-0 overflow-hidden"
          : "caf-need-followup-card--mobile"
      }`}
    >
      <div className={`caf-panel-header ${isWallboard ? "caf-panel-header-compact" : "caf-panel-header-mobile"}`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="rounded-md bg-rose-500/20 p-0.5">
              <BellRing className={`${isWallboard ? "h-3 w-3" : "h-3.5 w-3.5"} text-rose-300`} />
            </div>
            <span className={`caf-subtitle text-rose-200 ${isWallboard ? "" : "text-sm"}`}>
              Need Follow-up
            </span>
            {isWallboard ? (
              <div
                className="caf-need-followup-milestones caf-need-followup-milestones--inline"
                aria-label="Required AF milestones (all complete)"
              >
                {MILESTONE_TAGS.map((tag) => (
                  <span key={tag} className="caf-need-followup-milestone">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {!isWallboard ? (
            <p
              className="truncate text-[11px] text-white/50"
              title="Implementation statuses · AF milestones complete"
            >
              Await Impl · TLP Final · Done
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div
            className={`flex items-baseline gap-1 rounded-md bg-rose-500/10 ${
              isWallboard ? "px-1.5 py-px" : "px-2 py-0.5"
            }`}
          >
            <span className={`text-rose-200/70 ${isWallboard ? "text-[8px]" : "text-[10px]"}`}>Total</span>
            <span
              className={`font-bold tabular-nums text-rose-300 ${
                isWallboard ? "text-[11px]" : "text-sm"
              }`}
            >
              {data.total.toLocaleString()}
            </span>
          </div>
          {data.statusTotal > 0 ? (
            <span
              className={`tabular-nums text-white/45 ${
                isWallboard ? "text-[6px] leading-none" : "text-[10px]"
              }`}
            >
              {data.shareOfStatusPct}% of {data.statusTotal.toLocaleString()} in scope
            </span>
          ) : null}
        </div>
      </div>

      {!isWallboard ? (
        <div className="caf-need-followup-milestones" aria-label="Required AF milestones (all complete)">
          {MILESTONE_TAGS.map((tag) => (
            <span key={tag} className="caf-need-followup-milestone">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-red-300/90">
          {error}
        </div>
      ) : data.total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">
          No CAF items need follow-up
        </div>
      ) : (
        <div
          ref={groupsRef}
          className={`caf-need-followup-groups ${
            isWallboard
              ? "caf-need-followup-groups--wallboard min-h-0 flex-1"
              : "caf-need-followup-groups--mobile"
          }`}
        >
          {visibleGroups.map((group) => (
            <StatusGroupPanel
              key={group.statusId}
              group={group}
              layout={layout}
              wallboardRowsPerPage={measuredWallboardRows}
            />
          ))}
        </div>
      )}
    </div>
  )
})

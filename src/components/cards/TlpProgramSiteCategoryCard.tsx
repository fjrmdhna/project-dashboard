"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronRight as RowChevron, Layers } from "lucide-react"
import type { TlpCategoryCounts, TlpProgramGroupRow, TlpProjectGroupRow } from "@/lib/tlp-program-site-category"
import {
  TLP_SITE_CATEGORY_COLORS,
  truncateChartLabel,
} from "@/lib/tlp-program-site-category"
import { TlpCardHeader, TlpCardHeaderTotalBadge } from "@/components/cards/tlp/TlpCardHeader"

const ROWS_PER_PAGE = 4

const OVERVIEW_GRID = "grid-cols-[minmax(0,34%)_1fr_2.25rem_0.875rem]"
const PROJECT_GRID = "grid-cols-[minmax(0,38%)_1fr_2.25rem]"

interface TlpProgramSiteCategoryCardProps {
  categories: string[]
  groups: TlpProgramGroupRow[]
  projectsByGroup: Record<string, TlpProjectGroupRow[]>
  grandTotal: number
  isLoading?: boolean
  error?: string | null
}

type CardView = "overview" | "projects"

function segmentMinWidthPx(value: number): number {
  if (value >= 1000) return 28
  if (value >= 100) return 24
  if (value >= 10) return 18
  return 13
}

function CategoryLegend({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 border-t border-white/8 pt-1.5">
      {categories.map((category) => (
        <span key={category} className="inline-flex items-center gap-1 text-[8px] text-white/65">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: TLP_SITE_CATEGORY_COLORS[category] ?? "#94A3B8" }}
          />
          <span className="whitespace-nowrap">{category}</span>
        </span>
      ))}
    </div>
  )
}

function CategoryStackedBar({
  counts,
  categories,
}: {
  counts: TlpCategoryCounts
  categories: string[]
}) {
  const rowTotal = categories.reduce((sum, cat) => sum + (counts[cat] ?? 0), 0)

  if (rowTotal <= 0) {
    return <div className="h-3 w-full rounded-sm bg-white/[0.04]" />
  }

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm bg-white/[0.06]">
      {categories.map((category) => {
        const value = counts[category] ?? 0
        if (value <= 0) return null

        return (
          <div
            key={category}
            className="relative flex h-full min-w-0 shrink items-center justify-center overflow-hidden"
            style={{
              flex: value,
              minWidth: segmentMinWidthPx(value),
              backgroundColor: TLP_SITE_CATEGORY_COLORS[category] ?? "#94A3B8",
            }}
            title={`${category}: ${value.toLocaleString()}`}
          >
            <span className="pointer-events-none select-none text-[7px] font-bold leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.85)]">
              {value.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PaginationControls({
  pageIndex,
  totalPages,
  onPrev,
  onNext,
}: {
  pageIndex: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex shrink-0 items-center gap-0.5 text-[9px] text-white/60">
      <button
        type="button"
        onClick={onPrev}
        disabled={pageIndex === 0}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums">
        {pageIndex + 1}/{totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={pageIndex >= totalPages - 1}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}

function OverviewRow({
  label,
  counts,
  categories,
  total,
  onOpen,
}: {
  label: string
  counts: TlpCategoryCounts
  categories: string[]
  total: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group grid ${OVERVIEW_GRID} min-h-[24px] w-full items-center gap-x-1.5 rounded-md border border-transparent px-0.5 text-left transition-colors hover:border-cyan-400/20 hover:bg-white/[0.04]`}
      aria-label={`Open projects for ${label}`}
    >
      <span className="min-w-0 truncate text-[8px] font-medium leading-tight text-white/90" title={label}>
        {truncateChartLabel(label, 24)}
      </span>
      <CategoryStackedBar counts={counts} categories={categories} />
      <span className="text-right text-[8px] font-bold tabular-nums text-white">{total.toLocaleString()}</span>
      <RowChevron className="h-3 w-3 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/80" />
    </button>
  )
}

function ProjectRow({
  label,
  counts,
  categories,
  total,
}: {
  label: string
  counts: TlpCategoryCounts
  categories: string[]
  total: number
}) {
  return (
    <div className={`grid ${PROJECT_GRID} min-h-[24px] w-full items-center gap-x-1.5 px-0.5`}>
      <span className="min-w-0 truncate text-[8px] font-medium leading-tight text-white/88" title={label}>
        {truncateChartLabel(label, 28)}
      </span>
      <CategoryStackedBar counts={counts} categories={categories} />
      <span className="text-right text-[8px] font-bold tabular-nums text-white">{total.toLocaleString()}</span>
    </div>
  )
}

export function TlpProgramSiteCategoryCard({
  categories,
  groups,
  projectsByGroup,
  grandTotal,
  isLoading = false,
  error,
}: TlpProgramSiteCategoryCardProps) {
  const [view, setView] = useState<CardView>("overview")
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    setView("overview")
    setSelectedGroup(null)
    setPageIndex(0)
  }, [groups, projectsByGroup])

  useEffect(() => {
    setPageIndex(0)
  }, [view, selectedGroup])

  const activeCategories = useMemo(() => {
    const used = new Set<string>()
    const source =
      view === "projects" && selectedGroup
        ? (projectsByGroup[selectedGroup] ?? [])
        : groups

    for (const item of source) {
      for (const category of categories) {
        if ((item.counts[category] ?? 0) > 0) used.add(category)
      }
    }
    return categories.filter((category) => used.has(category))
  }, [categories, groups, projectsByGroup, view, selectedGroup])

  const selectedProjects = useMemo(() => {
    if (!selectedGroup) return []
    return projectsByGroup[selectedGroup] ?? []
  }, [projectsByGroup, selectedGroup])

  const selectedGroupTotal = useMemo(() => {
    if (!selectedGroup) return 0
    return groups.find((group) => group.programGroup === selectedGroup)?.total ?? 0
  }, [groups, selectedGroup])

  const listItems = view === "overview" ? groups : selectedProjects
  const totalPages = Math.max(1, Math.ceil(listItems.length / ROWS_PER_PAGE))
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1))
    }
  }, [pageIndex, totalPages])

  const pageItems = useMemo(() => {
    const start = safePageIndex * ROWS_PER_PAGE
    return listItems.slice(start, start + ROWS_PER_PAGE)
  }, [listItems, safePageIndex])

  const openProjects = (programGroup: string) => {
    setSelectedGroup(programGroup)
    setView("projects")
  }

  const goBack = () => {
    setView("overview")
    setSelectedGroup(null)
  }

  const displayTotal = view === "projects" ? selectedGroupTotal : grandTotal
  const overviewHint = "Select a program group to view projects"
  const showLoading = isLoading && groups.length === 0

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0F1630]/80"
      style={{ padding: "calc(var(--wb-card-padding) - 6px)" }}
      title={view === "overview" ? overviewHint : selectedGroup ?? undefined}
    >
      <TlpCardHeader
        title={view === "projects" ? "Projects" : "Program by Site Category"}
        icon={view === "projects" ? undefined : Layers}
        tone="cyan"
        subtitle={view === "projects" && selectedGroup ? selectedGroup : undefined}
        leading={
          view === "projects" ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-white/15 bg-white/10 px-1 py-0.5 text-[9px] font-semibold text-white/90 transition-colors hover:bg-white/20"
              aria-label="Back to program groups"
            >
              <ArrowLeft className="h-2.5 w-2.5" />
              Back
            </button>
          ) : undefined
        }
        trailing={
          <>
            <TlpCardHeaderTotalBadge total={displayTotal} tone="cyan" />
            <PaginationControls
              pageIndex={safePageIndex}
              totalPages={totalPages}
              onPrev={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            />
          </>
        }
      />

      {/* Body */}
      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-red-300/90">{error}</div>
      ) : listItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[9px] text-white/50">
          {view === "overview" ? "No data available" : "No projects in this group"}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            {view === "overview"
              ? (pageItems as TlpProgramGroupRow[]).map((group) => (
                  <OverviewRow
                    key={group.programGroup}
                    label={group.programGroup}
                    counts={group.counts}
                    categories={activeCategories}
                    total={group.total}
                    onOpen={() => openProjects(group.programGroup)}
                  />
                ))
              : (pageItems as TlpProjectGroupRow[]).map((project) => (
                  <ProjectRow
                    key={project.projectName}
                    label={project.projectName}
                    counts={project.counts}
                    categories={activeCategories}
                    total={project.total}
                  />
                ))}
          </div>
          <CategoryLegend categories={activeCategories} />
        </>
      )}
    </div>
  )
}

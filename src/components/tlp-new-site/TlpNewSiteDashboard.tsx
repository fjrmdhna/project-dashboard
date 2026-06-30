"use client"

import Link from "next/link"
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import { ChevronDown, Download, SlidersHorizontal } from "lucide-react"
import { DashboardExportButton, downloadExportResponse } from "@/components/dashboard/DashboardExportButton"
import { DashboardLoadingScreen } from "@/components/dashboard/DashboardLoadingScreen"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { TlpRfiByCircleCard } from "@/components/cards/TlpRfiByCircleCard"
import { TlpAccProgressCurveCard } from "@/components/cards/TlpAccProgressCurveCard"
import { TlpTopVendorRfiCard } from "@/components/cards/TlpTopVendorRfiCard"
import { TlpIssueCard } from "@/components/cards/TlpIssueCard"
import { TlpProgramSiteCategoryCard } from "@/components/cards/TlpProgramSiteCategoryCard"
import { TlpWeeklyAchievementCard } from "@/components/cards/TlpWeeklyAchievementCard"
import { TlpRfiNotCrfiIssueCard } from "@/components/cards/TlpRfiNotCrfiIssueCard"
import { TlpSiteReturnCard } from "@/components/cards/TlpSiteReturnCard"
import { TlpNewSiteFilterBar } from "@/components/filters/TlpNewSiteFilterBar"
import { type FilterValue } from "@/components/filters/FilterBar"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useTlpDashboard } from "@/hooks/useTlpDashboard"
import { useDashboardScrollLayout } from "@/hooks/useDashboardScrollLayout"
import type { TlpDashboardAggregated } from "@/lib/tlp-dashboard-aggregate"
import { type TlpSiteFilters, tlpFiltersToQueryString } from "@/lib/tlp-new-site-filters"

const INITIAL_TLP_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  project_name: [],
  program_group: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  region: [],
  year: [],
  circle: [],
  site_category: [],
  ran_score: [],
  pm_indosat: [],
  priority_congest_urgent: [],
  trial_gb_factory: [],
}

function countActiveTlpFilterGroups(filter: FilterValue): number {
  let count = 0
  if ((filter.program_group?.length ?? 0) > 0) count += 1
  if ((filter.project_name?.length ?? 0) > 0) count += 1
  if ((filter.year?.length ?? 0) > 0) count += 1
  if ((filter.site_category?.length ?? 0) > 0) count += 1
  if ((filter.vendor_name?.length ?? 0) > 0) count += 1
  return count
}

function buildTlpCardSlots(
  d: TlpDashboardAggregated,
  error: string | null | undefined,
  matrixLayout: "default" | "mobile"
) {
  return {
    matrixStats: (
      <MatrixStatsCard
        variant="tlp"
        layout={matrixLayout}
        rows={[]}
        stats={{
          totalSites: d.matrix.totalSites,
          crfi: d.matrix.crfi,
          rfi: d.matrix.rfi,
          construction: d.matrix.construction,
          rfc: d.matrix.rfc,
          sitac: d.matrix.sitac,
          searching: d.matrix.searching,
          returnCount: d.matrix.returnCount,
        }}
      />
    ),
    readinessCard: (
      <TlpRfiByCircleCard
        rows={d.rfiByCircle}
        totalPlanRfi={d.totalPlanRfi}
        totalActualRfi={d.totalActualRfi}
        isLoading={false}
        error={error}
      />
    ),
    activatedCard: <TlpTopVendorRfiCard rows={d.topVendorRfi} isLoading={false} error={error} />,
    progressCurve: <TlpAccProgressCurveCard data={d.accProgress} isLoading={false} error={error} />,
    dailyRunrate: (
      <TlpWeeklyAchievementCard
        monthLabel={d.weeklyAchievement.monthLabel}
        weeks={d.weeklyAchievement.weeks}
        mtd={d.weeklyAchievement.mtd}
        isLoading={false}
        error={error}
      />
    ),
    top5Issue: (
      <TlpIssueCard
        issues={d.issues}
        totalIssues={d.totalIssues}
        categoryCount={d.categoryCount}
        isLoading={false}
      />
    ),
    nanoCluster: (
      <TlpProgramSiteCategoryCard
        categories={d.programSiteCategory.categories}
        groups={d.programSiteCategory.groups}
        projectsByGroup={d.programSiteCategory.projectsByGroup}
        grandTotal={d.programSiteCategory.grandTotal}
        isLoading={false}
        error={error}
      />
    ),
    newFeature: (
      <TlpRfiNotCrfiIssueCard
        rows={d.rfiNotCrfi.rows}
        regions={d.rfiNotCrfi.regions}
        totalIssues={d.rfiNotCrfi.totalIssues}
        skippedWithoutRanVendor={d.rfiNotCrfi.skippedWithoutRanVendor}
        isLoading={false}
        error={error}
      />
    ),
    leaderboard: (
      <TlpSiteReturnCard
        rows={d.siteReturn.rows}
        statuses={d.siteReturn.statuses}
        woReleasedTotal={d.siteReturn.woReleasedTotal}
        inProcessTotal={d.siteReturn.inProcessTotal}
        grandTotal={d.siteReturn.grandTotal}
        skippedWithoutStatus={d.siteReturn.skippedWithoutStatus}
        isLoading={false}
        error={error}
      />
    ),
  }
}

export function TlpNewSiteDashboard() {
  const [filter, setFilter] = useState<FilterValue>(INITIAL_TLP_FILTER)
  const [isExporting, setIsExporting] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [, startFilterTransition] = useTransition()
  const isScrollLayout = useDashboardScrollLayout()

  const handleFilterChange = useCallback((next: FilterValue) => {
    startFilterTransition(() => setFilter(next))
  }, [])

  const handleFilterReset = useCallback(() => {
    startFilterTransition(() => setFilter(INITIAL_TLP_FILTER))
  }, [])

  const tlpFilters: TlpSiteFilters = useMemo(
    () => ({
      year: filter.year?.length ? filter.year.map((y) => Number(y)).filter((n) => !Number.isNaN(n)) : undefined,
      program_group: filter.program_group?.length ? filter.program_group : undefined,
      project_name: filter.project_name?.length ? filter.project_name : undefined,
      site_category: filter.site_category?.length ? filter.site_category : undefined,
      twr_owner: filter.vendor_name?.length ? filter.vendor_name : undefined,
    }),
    [filter]
  )

  const { committedDashboard, hasCommittedData, loading, isFilterPending, error } =
    useTlpDashboard(tlpFilters)

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  )

  const activeFilterCount = useMemo(() => countActiveTlpFilterGroups(filter), [filter])
  const hasActiveFilters = activeFilterCount > 0

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (!isScrollLayout) {
      setIsMobileFilterOpen(false)
    }
  }, [isScrollLayout])

  useEffect(() => {
    if (typeof document === "undefined") return
    const html = document.documentElement
    const body = document.body
    if (hasMounted && isScrollLayout) {
      html.classList.remove("viewport-active")
      body.classList.remove("viewport-active")
      html.style.overflowY = "auto"
      body.style.overflowY = "auto"
      html.style.position = ""
      body.style.position = ""
      html.style.height = "auto"
      body.style.height = "auto"
      return () => {
        html.style.overflowY = ""
        body.style.overflowY = ""
        html.style.position = ""
        body.style.position = ""
        html.style.height = ""
        body.style.height = ""
      }
    }
    return undefined
  }, [hasMounted, isScrollLayout])

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true)
      const qs = tlpFiltersToQueryString(tlpFilters)
      const response = await fetch(qs ? `/api/tlp-new-site/export?${qs}` : "/api/tlp-new-site/export")
      await downloadExportResponse(response, "tlp-new-site-export.xlsx")
    } catch (exportError) {
      console.error("Failed to export TLP New Site data", exportError)
    } finally {
      setIsExporting(false)
    }
  }, [tlpFilters])

  const renderMobileCard = (card: ReactNode, minHeight?: number) => {
    const style: CSSProperties = minHeight ? { minHeight, height: minHeight } : {}
    return (
      <div className="w-full flex flex-col" style={style}>
        {card}
      </div>
    )
  }

  const wallboardCards = useMemo(() => {
    if (!committedDashboard) return null
    return buildTlpCardSlots(committedDashboard, error, "default")
  }, [committedDashboard, error])

  const mobileCards = useMemo(() => {
    if (!committedDashboard) return null
    return buildTlpCardSlots(committedDashboard, error, "mobile")
  }, [committedDashboard, error])

  if (loading && !hasCommittedData) {
    return (
      <DashboardLoadingScreen
        label="TLP New Site"
        message="Retrieving latest TLP New Site data..."
        placeholders={["Matrix Statistics", "RFI by Circle", "ACC Progress", "Issues"]}
      />
    )
  }

  const header = (
    <ProgramHeader
      title="Dashboard TLP New Site"
      dateLabel={formattedDate}
      mapHref="/tlp-new-site/map"
      exportButton={<DashboardExportButton onClick={handleExport} isExporting={isExporting} />}
    />
  )

  const filterBar = (
    <TlpNewSiteFilterBar value={filter} onChange={handleFilterChange} onReset={handleFilterReset} />
  )

  const mobileLayout = (
    <div className="caf-mobile-layout min-h-[100dvh] min-h-screen bg-[#050B1B] text-white flex flex-col">
      <header className="bg-gradient-to-b from-[#121c3e] to-transparent px-4 pt-5 pb-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/"
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur transition hover:bg-white/20"
              aria-label="Back to home"
            >
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <img src="/logo-indosat-putih.png" alt="Indosat Logo" className="h-8" />
          </div>
          <div className="flex-1 text-right text-[11px] leading-tight text-white/80">
            <div className="font-medium">{formattedDate}</div>
          </div>
        </div>

        <h1 className="mt-4 text-center text-xl font-semibold tracking-wide text-white">
          Dashboard TLP New Site
        </h1>

        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] uppercase tracking-[0.32em]">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            title={isExporting ? "Exporting..." : "Export to Excel"}
          >
            <Download className="h-3 w-3" />
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">
            Overview
          </span>
          <Link
            href="/tlp-new-site/map"
            className="rounded-full border border-white/20 px-3 py-1 font-medium text-white/80 transition hover:bg-white/10"
          >
            Map
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        {isFilterPending ? (
          <div className="sticky top-0 z-10 flex justify-end px-4 pt-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
              Updating...
            </span>
          </div>
        ) : null}

        <section className="px-4 pt-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111d41]/90 shadow-[0_10px_30px_rgba(5,11,27,0.45)] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-white/80" />
                <span>Filter Data</span>
                {hasActiveFilters ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isMobileFilterOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isMobileFilterOpen ? (
              <div className="border-t border-white/10 bg-[#050B1B]/60 px-3 py-3">
                <TlpNewSiteFilterBar
                  variant="stacked"
                  value={filter}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                />
              </div>
            ) : null}
          </div>
        </section>

        {mobileCards ? (
          <section className="caf-mobile-layout__cards space-y-4 px-4 pb-8 pt-4">
            {renderMobileCard(mobileCards.matrixStats)}
            <div className="grid gap-4 sm:grid-cols-2">
              {renderMobileCard(mobileCards.readinessCard, 260)}
              {renderMobileCard(mobileCards.activatedCard, 260)}
            </div>
            {renderMobileCard(mobileCards.progressCurve, 280)}
            <div className="grid gap-4 sm:grid-cols-2">
              {renderMobileCard(mobileCards.dailyRunrate, 280)}
              {renderMobileCard(mobileCards.top5Issue, 280)}
            </div>
            {renderMobileCard(mobileCards.nanoCluster, 220)}
            {renderMobileCard(mobileCards.newFeature, 220)}
            {renderMobileCard(mobileCards.leaderboard, 280)}
          </section>
        ) : null}
      </main>
    </div>
  )

  const wallboardView = (
    <div className="relative h-full w-full">
      {isFilterPending ? (
        <div className="pointer-events-none absolute right-3 top-[4.5rem] z-20 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
          Updating...
        </div>
      ) : null}
      {wallboardCards ? (
        <Wallboard1080 header={header} filterBar={filterBar} {...wallboardCards} />
      ) : (
        <Wallboard1080 header={header} filterBar={filterBar} />
      )}
    </div>
  )

  return <>{hasMounted && isScrollLayout ? mobileLayout : wallboardView}</>
}

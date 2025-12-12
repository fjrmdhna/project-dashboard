"use client"

import Link from "next/link"
import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { FilterBar, type FilterValue } from "@/components/filters/FilterBar"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { useTLPAccData } from "@/hooks/useTLPAccData"
import TLPAccChart from "@/components/charts/TLPAccChart"
import { useTLPTopIssueData } from "@/hooks/useTLPTopIssueData"
import { TopIssueCard } from "@/components/cards/TopIssueCard"

const TLPNewSiteLoadingScreen = ({ message }: { message: string }) => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#030a1f] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050B1B]/70 via-transparent to-[#050B1B]" />
    </div>

    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.65em] text-white/60">TLP New Site</p>
        <h1 className="text-3xl font-semibold tracking-wide">Preparing Dashboard</h1>
        <p className="text-sm text-white/70">{message}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full border border-emerald-400/30" />
          <span className="absolute inline-flex h-[88px] w-[88px] rounded-full border border-white/10" />
          <span className="h-16 w-16 animate-spin rounded-full border-2 border-transparent border-l-emerald-300 border-t-cyan-300" />
        </div>
        <div className="w-52">
          <div className="hermes-loading-pill h-2 w-full rounded-full bg-white/20" />
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-white/60">Data Synchronization</p>
        </div>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Matrix Statistics", "Activation Progress", "Vendor Performance"].map((label) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{label}</p>
            <div className="mt-4 space-y-3">
              <div className="hermes-loading-pill h-8 w-full rounded-xl bg-white/10" />
              <div className="hermes-loading-pill h-2 w-3/4 rounded-full bg-white/10" />
              <div className="flex items-center gap-3 text-[11px] text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300/80" />
                <span>Retrieving latest metrics...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  status: []
}

// Placeholder component untuk cards
const PlaceholderCard = ({ title, description }: { title: string; description?: string }) => (
  <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col">
    <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
    <div className="flex-1 flex items-center justify-center text-white/50">
      <p className="text-sm">{description || "Coming soon"}</p>
    </div>
  </div>
)

export default function TLPNewSitePage() {
  const [filterValue, setFilterValue] = useState<FilterValue>(INITIAL_FILTER)
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const isMobile = useIsMobile()
  
  // Fetch ACC data
  const { data: accData, loading: accLoading } = useTLPAccData({ filter: filterValue })
  
  // Fetch Top Issue data
  const { 
    data: topIssues, 
    loading: topIssuesLoading, 
    topIssuesTotal, 
    totalIssues 
  } = useTLPTopIssueData({ filter: filterValue })

  useEffect(() => {
    // Simulate initial data load
    const timer = setTimeout(() => {
      setHasInitialDataLoaded(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
    []
  )

  // Calculate active filter count
  const activeFilterCount = (
    (filterValue.q ? 1 : 0) +
    filterValue.vendor_name.length +
    filterValue.program_report.length +
    filterValue.imp_ttp.length +
    filterValue.nano_cluster.length
  )
  const hasActiveFilters = activeFilterCount > 0

  const handleFilterChange = (value: FilterValue) => {
    setFilterValue(value)
  }

  const handleFilterReset = () => {
    setFilterValue(INITIAL_FILTER)
  }

  const filterPanel = (
    <div className="flex h-full flex-col gap-3">
      <FilterBar
        value={filterValue}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
      />
      <p className="text-[10px] text-white/50">
        TLP New Site dashboard - placeholder components. Integration in progress.
      </p>
    </div>
  )

  // Placeholder components untuk cards
  const matrixStats = <PlaceholderCard title="Matrix Statistics" description="Matrix statistics will be displayed here" />
  const readinessCard = <PlaceholderCard title="5G Readiness" description="5G readiness metrics will be displayed here" />
  const activatedCard = <PlaceholderCard title="5G Activated" description="5G activation metrics will be displayed here" />
  const progressCurve = accLoading ? (
    <PlaceholderCard title="ACC Progress" description="Loading chart data..." />
  ) : (
    <TLPAccChart data={accData} />
  )
  const dailyRunrate = <PlaceholderCard title="Daily Runrate" description="Daily runrate metrics will be displayed here" />
  const topIssueCard = (
    <TopIssueCard
      issues={topIssues}
      totalIssues={totalIssues}
      topIssuesTotal={topIssuesTotal}
      isLoading={topIssuesLoading}
    />
  )
  const nanoClusterCard = <PlaceholderCard title="Nano Cluster" description="Nano cluster metrics will be displayed here" />
  const nanoClusterList = <PlaceholderCard title="Nano Cluster List" description="Nano cluster list will be displayed here" />
  const leaderboard = <PlaceholderCard title="Vendor Leaderboard" description="Vendor leaderboard will be displayed here" />

  const header = (
    <ProgramHeader
      title="Dashboard TLP New Site 2025"
      dateLabel={formattedDate}
      mapHref="/tlp-new-site/map"
    />
  )

  const wallboardView = (
    <Wallboard1080
      header={header}
      filterBar={filterPanel}
      matrixStats={matrixStats}
      readinessCard={readinessCard}
      activatedCard={activatedCard}
      progressCurve={progressCurve}
      dailyRunrate={dailyRunrate}
      top5Issue={topIssueCard}
      nanoCluster={nanoClusterCard}
      newFeature={nanoClusterList}
      leaderboard={leaderboard}
    />
  )

  const renderMobileCard = (node: ReactNode, minHeight?: number) => {
    const style: CSSProperties = minHeight
      ? { minHeight, height: minHeight }
      : {}

    return (
      <div className="w-full flex flex-col" style={style}>
        {node}
      </div>
    )
  }

  const mobileLayout = (
    <div className="min-h-screen bg-[#050B1B] text-white flex flex-col">
      <header className="bg-gradient-to-b from-[#121c3e] to-transparent px-4 pt-5 pb-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20 transition"
            >
              <svg 
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex justify-center">
            <img
              src="/logo-indosat-putih.png"
              alt="Indosat Logo"
              className="h-8"
            />
          </div>

          <div className="flex-1 text-right text-[11px] leading-tight text-white/80">
            <div className="font-medium">{formattedDate}</div>
          </div>
        </div>

        <h1 className="mt-4 text-center text-xl font-semibold tracking-wide text-white">
          DASHBOARD TLP NEW SITE 2025
        </h1>
        <div className="mt-3 flex justify-center gap-3 text-[11px] uppercase tracking-[0.32em]">
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">Overview</span>
          <Link
            href="/tlp-new-site/map"
            className="rounded-full border border-white/20 px-3 py-1 font-medium text-white/80 transition hover:bg-white/10"
          >
            Map
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        <section className="px-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-[#111d41]/90 backdrop-blur-sm shadow-[0_10px_30px_rgba(5,11,27,0.45)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-white/80" />
                <span>Filter Data</span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isMobileFilterOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isMobileFilterOpen && (
              <div className="border-t border-white/10 bg-[#050B1B]/60 px-3 py-3">
                <FilterBar
                  value={filterValue}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                />
                <p className="mt-2 text-[11px] text-white/50">
                  TLP New Site dashboard - placeholder components. Integration in progress.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="px-4 pt-4 pb-8 space-y-4">
          {renderMobileCard(matrixStats)}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderMobileCard(readinessCard, 260)}
            {renderMobileCard(activatedCard, 260)}
          </div>

          {renderMobileCard(progressCurve, 280)}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderMobileCard(dailyRunrate, 280)}
            {renderMobileCard(topIssueCard, 280)}
          </div>

          {renderMobileCard(nanoClusterCard, 200)}
          {renderMobileCard(nanoClusterList, 200)}
          {renderMobileCard(leaderboard, 280)}
        </section>
      </main>
    </div>
  )

  // Show loading screen while initializing
  if (!hasInitialDataLoaded) {
    return <TLPNewSiteLoadingScreen message="Initializing TLP New Site dashboard..." />
  }

  return isMobile ? mobileLayout : wallboardView
}


"use client"

import Link from "next/link"
import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { FilterBar, type FilterValue } from "@/components/filters/FilterBar"
import { useDebounce } from "@/hooks/useDebounce"
import { MatrixStatsCard, type Row as MatrixRow } from "@/components/cards/MatrixStatsCard"
import { FiveGReadinessCard } from "@/components/cards/FiveGReadinessCard"
import { FiveGActivatedCard } from "@/components/cards/FiveGActivatedCard"
import ProgressCurveLineChart from "@/components/charts/ProgressCurveLineChart"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { TopIssueCard } from "@/components/cards/TopIssueCard"
import { GapStatusCard } from "@/components/cards/GapStatusCard"
import { NanoClusterListCard } from "@/components/cards/NewFeatureCard"
import { VendorLeaderboardCard } from "@/components/cards/VendorLeaderboardCard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { useNewSiteTopIssueData } from "@/hooks/useNewSiteTopIssueData"
import { useNewSiteData } from "@/hooks/useNewSiteData"
import { useNewSiteDailyRunrateData } from "@/hooks/useNewSiteDailyRunrateData"

const NewSiteLoadingScreen = ({ message }: { message: string }) => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#030a1f] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050B1B]/70 via-transparent to-[#050B1B]" />
    </div>

    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.65em] text-white/60">New Site Dashboard</p>
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

type DashboardRow = MatrixRow & {
  nano_cluster?: string | null
  region_circle?: string | null
  mocn_activation_forecast?: string | null
}

const DASHBOARD_ROWS: DashboardRow[] = [
  {
    system_key: "AOP-001",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Jakarta",
    nano_cluster: "Ops Cluster Alpha",
    caf_approved: "2025-02-02",
    mos_af: "2025-02-10",
    ic_000040_af: "2025-02-18",
    imp_integ_af: "2025-02-24",
    rfs_forecast_lock: "2025-03-05",
    rfs_af: "2025-03-04",
    mocn_activation_forecast: "2025-02-22",
    endorse_af: "2025-03-09",
    lat: -6.2,
    long: 106.8
  },
  {
    system_key: "AOP-002",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Yogyakarta",
    nano_cluster: "Ops Cluster Beta",
    caf_approved: "2025-02-05",
    mos_af: "2025-02-13",
    ic_000040_af: "2025-02-22",
    imp_integ_af: "2025-03-03",
    rfs_forecast_lock: "2025-03-18",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-01",
    hotnews_af: "2025-03-06",
    lat: -7.8,
    long: 110.4
  },
  {
    system_key: "AOP-003",
    vendor_name: "Ericsson Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Bandung",
    nano_cluster: "Ops Cluster Gamma",
    caf_approved: "2025-02-08",
    mos_af: "2025-02-16",
    ic_000040_af: "2025-02-24",
    imp_integ_af: "2025-03-05",
    rfs_forecast_lock: "2025-03-20",
    rfs_af: "2025-03-18",
    mocn_activation_forecast: "2025-03-02",
    endorse_af: "2025-03-22",
    lat: -6.9,
    long: 107.6
  },
  {
    system_key: "AOP-004",
    vendor_name: "ZTE Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Medan",
    nano_cluster: "Ops Cluster Delta",
    caf_approved: "2025-02-11",
    mos_af: "2025-02-21",
    ic_000040_af: null,
    imp_integ_af: null,
    rfs_forecast_lock: "2025-04-02",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-18",
    lat: 3.6,
    long: 98.7
  },
  {
    system_key: "AOP-005",
    vendor_name: "Samsung Electronics Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Makassar",
    nano_cluster: "Ops Cluster Epsilon",
    caf_approved: "2025-02-06",
    mos_af: "2025-02-15",
    ic_000040_af: "2025-02-25",
    imp_integ_af: "2025-03-06",
    rfs_forecast_lock: "2025-03-24",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-10",
    lat: -5.1,
    long: 119.4
  },
  {
    system_key: "AOP-006",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Balikpapan",
    nano_cluster: "Ops Cluster Zeta",
    caf_approved: "2025-02-04",
    mos_af: "2025-02-12",
    ic_000040_af: "2025-02-20",
    imp_integ_af: "2025-02-28",
    rfs_forecast_lock: "2025-03-15",
    rfs_af: "2025-03-12",
    mocn_activation_forecast: "2025-02-26",
    endorse_af: "2025-03-17",
    lat: -1.27,
    long: 116.83
  },
  {
    system_key: "AOP-007",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "AOP Reinforcement",
    imp_ttp: "Denpasar",
    nano_cluster: "Ops Cluster Eta",
    caf_approved: "2025-02-09",
    mos_af: "2025-02-17",
    ic_000040_af: "2025-02-25",
    imp_integ_af: "2025-03-07",
    rfs_forecast_lock: "2025-03-26",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-12",
    lat: -8.65,
    long: 115.21
  },
  {
    system_key: "AOP-008",
    vendor_name: "Ericsson Indonesia",
    program_report: "AOP Reinforcement",
    imp_ttp: "Semarang",
    nano_cluster: "Ops Cluster Theta",
    caf_approved: "2025-02-07",
    mos_af: "2025-02-14",
    ic_000040_af: "2025-02-23",
    imp_integ_af: "2025-03-04",
    rfs_forecast_lock: "2025-03-21",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-05",
    hotnews_af: "2025-03-09",
    lat: -6.97,
    long: 110.42
  }
]



const INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  circle: []
}

export default function NewSitePage() {
  const [filterValue, setFilterValue] = useState<FilterValue>(INITIAL_FILTER)
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const isMobile = useIsMobile()

  // Debounce filter untuk unified debouncing (300ms seperti Hermes 5G)
  const debouncedFilterValue = useDebounce(filterValue, 300)

  // Fetch data from API menggunakan debounced filter
  const { data: newSiteData, stats: newSiteStats, loading: newSiteLoading, error: newSiteError } = useNewSiteData({
    vendorNames: debouncedFilterValue.vendor_name || [],
    programReports: debouncedFilterValue.program_report || [],
    circles: debouncedFilterValue.circle || [],
    search: debouncedFilterValue.q || ''
  })

  // Fetch top issues data from API menggunakan debounced filter
  const { data: topIssues, loading: topIssuesLoading, topIssuesTotal, totalIssues } = useNewSiteTopIssueData({
    filter: debouncedFilterValue
  })

  // Fetch daily runrate data from API menggunakan debounced filter
  const { data: dailyRunrateData, loading: dailyRunrateLoading } = useNewSiteDailyRunrateData({
    filter: debouncedFilterValue
  })

  // Combine loading states untuk menentukan isAnyDataLoading (seperti Hermes 5G)
  const isAnyDataLoading = newSiteLoading || topIssuesLoading || dailyRunrateLoading

  // Track when initial data has been loaded
  useEffect(() => {
    if (!isAnyDataLoading && (newSiteData || newSiteError)) {
      setHasInitialDataLoaded(true)
    }
  }, [isAnyDataLoading, newSiteData, newSiteError])

  // Use API data only - don't show placeholder data while loading
  const rows = useMemo(() => {
    // Don't show data while initial loading
    if (isAnyDataLoading && !hasInitialDataLoaded) {
      return [] // Return empty array while loading
    }
    if (newSiteData && newSiteData.length > 0) {
      return newSiteData as MatrixRow[]
    }
    // Only show placeholder if there's an error and no data (after initial load)
    if (hasInitialDataLoaded && newSiteError && (!newSiteData || newSiteData.length === 0)) {
      return DASHBOARD_ROWS
    }
    return []
  }, [newSiteData, isAnyDataLoading, newSiteError, hasInitialDataLoaded])

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
    filterValue.nano_cluster.length +
    (filterValue.circle?.length ?? 0)
  )
  const hasActiveFilters = activeFilterCount > 0

  const totalSites = rows.length
  const readinessCount = rows.filter(row => row.imp_integ_af).length
  const activatedCount = rows.filter(row => row.rfs_af).length
  
  // Calculate PATP count (using stats from API if available)
  const patpCount = newSiteStats?.pac || 0

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
        variant="newSite"
        endpoint="/api/new-site/filters"
      />
      {newSiteLoading && (
        <p className="text-[10px] text-white/50">
          Loading New Site data...
        </p>
      )}
      {newSiteError && (
        <p className="text-[10px] text-red-400">
          Error: {newSiteError}. Using placeholder data.
        </p>
      )}
      {!newSiteLoading && !newSiteError && newSiteData && newSiteData.length > 0 && (
        <p className="text-[10px] text-white/50">
          Live New Site operational metrics from database ({newSiteData.length} sites).
        </p>
      )}
      {!newSiteLoading && !newSiteError && (!newSiteData || newSiteData.length === 0) && (
        <p className="text-[10px] text-white/50">
          Placeholder dataset. No New Site data found in database.
        </p>
      )}
    </div>
  )

  const matrixStats = <MatrixStatsCard rows={rows} patpCount={patpCount} variant="newSite" />
  const readinessCard = <FiveGReadinessCard rows={rows} maxCities={8} variant="circle" dataVariant="newSite" />
  const activatedCard = <FiveGActivatedCard rows={rows} maxCities={8} variant="circle" dataVariant="newSite" />
  const gapStatusCard = <GapStatusCard rows={rows} />
  const progressCurve = (
    <ProgressCurveLineChart rows={rows} anchorDate={new Date().toISOString()} monthsSpan={3} />
  )
  const dailyRunrate = (
    <DailyRunrateCard 
      data={dailyRunrateData} 
      isLoading={dailyRunrateLoading} 
    />
  )
  const topIssueCard = (
    <TopIssueCard
      issues={topIssues}
      totalIssues={totalIssues}
      topIssuesTotal={topIssuesTotal}
      isLoading={topIssuesLoading}
    />
  )
  const nanoClusterList = <NanoClusterListCard rows={rows} />
  const leaderboard = <VendorLeaderboardCard rows={rows} />

  const header = <ProgramHeader title="Dashboard New Site 2025" dateLabel={formattedDate} />

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
      nanoCluster={gapStatusCard}
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
          DASHBOARD NEW SITE 2025
        </h1>
        <div className="mt-3 flex justify-center gap-3 text-[11px] uppercase tracking-[0.32em]">
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">Overview</span>
          <Link
            href="/new-site/map"
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
                  variant="newSite"
                  endpoint="/api/new-site/filters"
                />
                {newSiteLoading && (
                  <p className="mt-2 text-[11px] text-white/50">
                    Loading New Site data...
                  </p>
                )}
                {newSiteError && (
                  <p className="mt-2 text-[11px] text-red-400">
                    Error: {newSiteError}. Using placeholder data.
                  </p>
                )}
                {!newSiteLoading && !newSiteError && newSiteData && newSiteData.length > 0 && (
                  <p className="mt-2 text-[11px] text-white/50">
                    Live New Site operational metrics from database ({newSiteData.length} sites).
                  </p>
                )}
                {!newSiteLoading && !newSiteError && (!newSiteData || newSiteData.length === 0) && (
                  <p className="mt-2 text-[11px] text-white/50">
                    Placeholder data shown. No New Site data found in database.
                  </p>
                )}
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

          {renderMobileCard(gapStatusCard, 200)}
          {renderMobileCard(nanoClusterList, 200)}
          {renderMobileCard(leaderboard, 280)}
        </section>
      </main>
    </div>
  )

  // Show loading screen while fetching initial data
  if (!hasInitialDataLoaded) {
    const loadingMessage = newSiteLoading 
      ? "Retrieving latest New Site operational metrics from database..."
      : "Initializing dashboard..."
    return <NewSiteLoadingScreen message={loadingMessage} />
  }

  return isMobile ? mobileLayout : wallboardView
}

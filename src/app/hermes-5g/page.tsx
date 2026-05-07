"use client"

import Link from "next/link"
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { ChevronDown, SlidersHorizontal, Download } from "lucide-react"
import { FilterBar, FilterValue } from "@/components/filters/FilterBar"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { FiveGReadinessCard } from "@/components/cards/FiveGReadinessCard"
import { FiveGActivatedCard } from "@/components/cards/FiveGActivatedCard"
import { NanoClusterCard } from "@/components/cards/NanoClusterCard"
import ProgressCurveLineChart from "@/components/charts/ProgressCurveLineChart"
import { TopIssueCard } from "@/components/cards/TopIssueCard"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { VendorLeaderboardCard } from "@/components/cards/VendorLeaderboardCard"
import { NanoClusterListCard } from "@/components/cards/NewFeatureCard"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { useFilter } from "@/contexts/FilterContext"
import { useHermes5GDataOptimized } from "@/hooks/useHermes5GDataOptimized"
import { useDeferredValue, useTransition } from "react"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
// Debug overlays removed for production-like view

const HermesLoadingScreen = ({ message }: { message: string }) => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#030a1f] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050B1B]/70 via-transparent to-[#050B1B]" />
    </div>

    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.65em] text-white/60">Hermes 5G</p>
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
        {["Activation Performance", "Readiness Snapshot", "Vendor Quality"].map((label) => (
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

export default function Hermes5GPage() {
  // Menggunakan shared filter context
  const filterContext = useFilter()
  
  // Convert filter context to FilterValue format - support multiselect
  // Note: regionFilter is used for circle filter (from region_circle). Hermes uses ran_score (RAN Score) instead of site_category.
  const currentFilter: FilterValue = useMemo(() => ({
    q: filterContext.searchTerm,
    vendor_name: filterContext.vendorFilter !== 'all' ? filterContext.vendorFilter.split(',').filter(Boolean) : [],
    program_report: filterContext.programFilter !== 'all' ? filterContext.programFilter.split(',').filter(Boolean) : [],
    imp_ttp: filterContext.cityFilter !== 'all' ? filterContext.cityFilter.split(',').filter(Boolean) : [],
    nano_cluster: filterContext.nanoClusterFilter !== 'all' ? filterContext.nanoClusterFilter.split(',').filter(Boolean) : [],
    circle: filterContext.regionFilter !== 'all' ? filterContext.regionFilter.split(',').filter(Boolean) : [],
    year: filterContext.yearFilter !== 'all' ? filterContext.yearFilter.split(',').filter(Boolean) : [],
    ran_score: filterContext.ranScoreFilter !== 'all' ? filterContext.ranScoreFilter.split(',').filter(Boolean) : [],
    status: filterContext.statusFilters || []
  }), [filterContext.searchTerm, filterContext.vendorFilter, filterContext.programFilter, filterContext.cityFilter, filterContext.nanoClusterFilter, filterContext.regionFilter, filterContext.yearFilter, filterContext.ranScoreFilter, filterContext.statusFilters])
  
  // Convert filter context to FilterValue format - use debouncedFilters from context (already debounced 300ms)
  // FilterContext already handles debouncing, so we use debouncedFilters directly
  // Note: regionFilter is used for circle filter (from region_circle)
  // IMPORTANT: Use debouncedFilters as the primary dependency to ensure we get debounced values
  const debouncedFilterValue: FilterValue = useMemo(() => {
    const debounced = filterContext.debouncedFilters || filterContext
    const circleValue = debounced.regionFilter !== 'all' ? debounced.regionFilter.split(',').filter(Boolean) : []
    const ranScoreValue = debounced.ranScoreFilter !== 'all' ? debounced.ranScoreFilter.split(',').filter(Boolean) : []
    return {
      q: debounced.searchTerm || '',
      vendor_name: debounced.vendorFilter !== 'all' ? debounced.vendorFilter.split(',').filter(Boolean) : [],
      program_report: debounced.programFilter !== 'all' ? debounced.programFilter.split(',').filter(Boolean) : [],
      imp_ttp: debounced.cityFilter !== 'all' ? debounced.cityFilter.split(',').filter(Boolean) : [],
      nano_cluster: debounced.nanoClusterFilter !== 'all' ? debounced.nanoClusterFilter.split(',').filter(Boolean) : [],
      circle: circleValue,
      year: debounced.yearFilter !== 'all' ? debounced.yearFilter.split(',').filter(Boolean) : [],
      ran_score: ranScoreValue,
      status: debounced.statusFilters || []
    }
  }, [filterContext.debouncedFilters])

  // Current filter (non-debounced) for display purposes
  const filterValue: FilterValue = useMemo(() => ({
    q: filterContext.searchTerm || '',
    vendor_name: filterContext.vendorFilter !== 'all' ? filterContext.vendorFilter.split(',').filter(Boolean) : [],
    program_report: filterContext.programFilter !== 'all' ? filterContext.programFilter.split(',').filter(Boolean) : [],
    imp_ttp: filterContext.cityFilter !== 'all' ? filterContext.cityFilter.split(',').filter(Boolean) : [],
    nano_cluster: filterContext.nanoClusterFilter !== 'all' ? filterContext.nanoClusterFilter.split(',').filter(Boolean) : [],
    circle: filterContext.regionFilter !== 'all' ? filterContext.regionFilter.split(',').filter(Boolean) : [],
    year: filterContext.yearFilter !== 'all' ? filterContext.yearFilter.split(',').filter(Boolean) : [],
    ran_score: filterContext.ranScoreFilter !== 'all' ? filterContext.ranScoreFilter.split(',').filter(Boolean) : [],
    status: filterContext.statusFilters || []
  }), [filterContext.searchTerm, filterContext.vendorFilter, filterContext.programFilter, filterContext.cityFilter, filterContext.nanoClusterFilter, filterContext.regionFilter, filterContext.yearFilter, filterContext.ranScoreFilter, filterContext.statusFilters])

  const [isPending, startTransition] = useTransition()

  // OPTIMIZATION: Stabilize filter arrays to prevent unnecessary re-renders
  const stableVendorNames = useMemo(() => debouncedFilterValue.vendor_name || [], [debouncedFilterValue.vendor_name])
  const stableProgramReports = useMemo(() => debouncedFilterValue.program_report || [], [debouncedFilterValue.program_report])
  const stableImpTtps = useMemo(() => debouncedFilterValue.imp_ttp || [], [debouncedFilterValue.imp_ttp])
  const stableNanoClusters = useMemo(() => debouncedFilterValue.nano_cluster || [], [debouncedFilterValue.nano_cluster])
  const stableRanScores = useMemo(() => debouncedFilterValue.ran_score || [], [debouncedFilterValue.ran_score])
  const stableYears = useMemo(() => debouncedFilterValue.year || [], [debouncedFilterValue.year])
  const stableCircles = useMemo(() => debouncedFilterValue.circle || [], [debouncedFilterValue.circle])
  const stableSearch = debouncedFilterValue.q || ''

  // Fetch data from API menggunakan debounced filter with stable references
  const { 
    data: hermesData, 
    stats: hermesStats, 
    aggregated: hermesAggregated, 
    loading: hermesLoading, 
    error: hermesError 
  } = useHermes5GDataOptimized({
    vendorNames: stableVendorNames,
    programReports: stableProgramReports,
    impTtps: stableImpTtps,
    nanoClusters: stableNanoClusters,
    ranScores: stableRanScores,
    years: stableYears,
    circles: stableCircles,
    siteCategories: [], // Hermes uses RAN Score filter instead of Site Category
    search: stableSearch
  })
  
  // Use deferred value for rows only (heavy visual component)
  const deferredAggregated = useDeferredValue(hermesAggregated)
  const rows = useDeferredValue(hermesData || [])
  const isStaleData = rows !== hermesData

  // Get top issues and daily runrate from aggregated data (client-side)
  const topIssuesData = hermesAggregated?.topIssues?.issues || []
  const topIssuesTotal = hermesAggregated?.topIssues?.top5Count || 0
  const totalIssues = hermesAggregated?.topIssues?.totalCount || 0
  const dailyRunrateData = hermesAggregated?.dailyRunrate || []

  // Loading state now only depends on main hermesLoading (no separate API calls)
  const loading = hermesLoading
  const error = hermesError ? new Error(hermesError) : null
  const count = hermesData?.length || 0
  const filter = filterValue

  const isMobile = useIsMobile()
  const [hasMounted, setHasMounted] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false)

  const isAnyDataLoading = loading

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (!isAnyDataLoading && filterContext.isHydrated) {
      setHasInitialDataLoaded(true)
    }
  }, [isAnyDataLoading, filterContext.isHydrated])

  useEffect(() => {
    if (!exportStatus) {
      return
    }

    const timeout = setTimeout(() => {
      setExportStatus(null)
    }, 5000)

    return () => {
      clearTimeout(timeout)
    }
  }, [exportStatus])

  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const activeFilterCount = (
    (filter.q ? 1 : 0) +
    filter.vendor_name.length +
    filter.program_report.length +
    filter.imp_ttp.length +
    filter.nano_cluster.length +
    (filter.circle?.length || 0) +
    (filter.ran_score?.length || 0)
  )

  const hasActiveFilters = activeFilterCount > 0

  const renderMobileCard = (card: ReactNode, minHeight?: number) => {
    const style: CSSProperties = minHeight
      ? { minHeight, height: minHeight }
      : {}

    return (
      <div className="w-full flex flex-col" style={style}>
        {card}
      </div>
    )
  }

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const html = document.documentElement
    const body = document.body

    if (hasMounted && isMobile) {
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
  }, [hasMounted, isMobile])
  // Handler untuk perubahan filter
  const handleFilterChange = (newFilters: FilterValue) => {
    console.log("Filter changed:", newFilters)
    // OPTIMIZED: Use startTransition untuk non-urgent state updates (mencegah UI freeze)
    startTransition(() => {
      // Update filter context - support multiselect by joining arrays
      // Note: circle filter is stored in regionFilter (for backward compatibility)
      filterContext.setSearchTerm(newFilters.q || '')
      filterContext.setVendorFilter(newFilters.vendor_name.length > 0 ? newFilters.vendor_name.join(',') : 'all')
      filterContext.setProgramFilter(newFilters.program_report.length > 0 ? newFilters.program_report.join(',') : 'all')
      filterContext.setCityFilter(newFilters.imp_ttp.length > 0 ? newFilters.imp_ttp.join(',') : 'all')
      filterContext.setNanoClusterFilter(newFilters.nano_cluster.length > 0 ? newFilters.nano_cluster.join(',') : 'all')
      const circleValue = newFilters.circle && newFilters.circle.length > 0 ? newFilters.circle.join(',') : 'all'
      const ranScoreValue = newFilters.ran_score && newFilters.ran_score.length > 0 ? newFilters.ran_score.join(',') : 'all'
      filterContext.setRegionFilter(circleValue)
      filterContext.setYearFilter(newFilters.year && newFilters.year.length > 0 ? newFilters.year.join(',') : 'all')
      filterContext.setRanScoreFilter(ranScoreValue)
    })
  }

  // Handler untuk reset filter
  const handleFilterReset = () => {
    console.log("Filters reset")
    filterContext.resetFilters()
  }

  const buildExportParams = () => {
    const params = new URLSearchParams()
    params.set('type', 'activation')

    if (filter.q) {
      params.set('q', filter.q)
    }

    filter.vendor_name.forEach((value) => {
      params.append('vendor_name', value)
    })

    filter.program_report.forEach((value) => {
      params.append('program_report', value)
    })

    filter.imp_ttp.forEach((value) => {
      params.append('imp_ttp', value)
    })

    filter.nano_cluster.forEach((value) => {
      params.append('nano_cluster', value)
    })

    filter.circle?.forEach((value) => {
      params.append('region_circle', value) // Using region_circle parameter name for API compatibility
    })

    filter.year?.forEach((value) => {
      params.append('year', value)
    })

    filter.ran_score?.forEach((value) => {
      params.append('ran_score', value)
    })

    return params
  }

  const handleExport = async () => {
    const exportType = 'activation'

    try {
      setExportStatus(null)
      setIsExporting(true)

      const params = buildExportParams()
      const response = await fetch(`/api/hermes-5g/export?${params.toString()}`)

      if (!response.ok) {
        let errorMessage = 'Failed to export data.'
        const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || ''

        try {
          if (contentType.includes('application/json')) {
            const payload = await response.json()
            if (payload?.message) {
              errorMessage = payload.message
            }
          } else {
            const text = await response.text()
            if (text) {
              errorMessage = text
            }
          }
        } catch {
          // ignore parse failure and fall back to the default message
        }

        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition')
      let filename = `hermes-5g-${exportType}-export.xlsx`

      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i)
        if (match?.[1]) {
          filename = match[1]
        }
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setExportStatus({
        type: 'success',
        message: 'Activation data downloaded successfully.'
      })
    } catch (error) {
      console.error('Failed to export Hermes 5G data', error)
      const message = error instanceof Error ? error.message : 'An error occurred during export.'
      setExportStatus({
        type: 'error',
        message
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Export button component - styled like AOP page
  const exportButton = (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-[0.32em]"
      title={isExporting ? 'Exporting...' : 'Export to Excel'}
    >
      <Download className="h-3 w-3" />
      {isExporting ? 'Exporting...' : 'Export'}
    </button>
  )

  // Header component
  const header = (
    <ProgramHeader
      title="Dashboard Hermes"
      dateLabel={formattedDate}
      mapHref="/hermes-5g/map"
      exportButton={exportButton}
    />
  )

  // FilterBar component — single row layout for Hermes
  const filterBar = (
    <div className="flex h-full flex-col gap-3">
      <FilterBar
        value={filter}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
        singleRow
      />
    </div>
  )

  // MatrixStats component - OPTIMIZED: Pass stats dari API untuk menghindari redundant calculation
  const matrixStats = (
    <MatrixStatsCard 
      rows={rows} 
      patpCount={hermesStats?.patp || 0}
      stats={hermesStats ? {
        totalSites: hermesStats.totalSites,
        caf: hermesStats.caf,
        mos: hermesStats.mos,
        install: hermesStats.install,
        rfs: hermesStats.activated,
        rfa: hermesStats.rfa,
        rfc: hermesStats.rfc,
        fatp: hermesStats.fatp,
        hotnews: hermesStats.hotnews,
        endorse: hermesStats.endorse,
        pac: hermesStats.pac
      } : undefined}
    />
  )

  // 5G Readiness component - OPTIMIZED: Use pre-aggregated data
  const readinessCard = (
    <FiveGReadinessCard 
      rows={rows} 
      maxCities={10} 
      variant="city"
      aggregatedByCircle={deferredAggregated?.byCity}
    />
  )

  // 5G Activated component - OPTIMIZED: Use pre-aggregated data
  const activatedCard = (
    <FiveGActivatedCard 
      rows={rows} 
      maxCities={10} 
      variant="city"
      aggregatedByCircle={deferredAggregated?.byCity}
    />
  )

  // Nano Cluster component
  const nanoClusterCard = (
    <NanoClusterCard rows={rows} />
  )

  // Progress Curve component
  const progressCurveCard = (
    <ProgressCurveLineChart rows={rows} anchorDate={new Date().toISOString()} monthsSpan={3} yAxisStartAtZero={false} />
  )
  

  // Daily Runrate component - OPTIMIZED: Use pre-aggregated data
  const dailyRunrateCard = (
    <DailyRunrateCard 
      data={dailyRunrateData} 
      isLoading={loading} 
    />
  )

  // TopIssueCard component - OPTIMIZED: Use pre-aggregated data
  const topIssueCard = (
    <TopIssueCard 
      issues={topIssuesData} 
      totalIssues={totalIssues} 
      topIssuesTotal={topIssuesTotal}
      isLoading={loading}
    />
  )

  // Nano Cluster List component
  const newFeatureCard = (
    <NanoClusterListCard 
      rows={rows}
    />
  )

  // Vendor Leaderboard component - OPTIMIZED: Use pre-aggregated data
  const vendorLeaderboardCard = (
    <VendorLeaderboardCard 
      rows={rows}
      isLoading={loading}
      aggregatedByVendor={deferredAggregated?.byVendor}
    />
  )

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
          Dashboard Hermes
        </h1>
        <div className="mt-3 flex justify-center gap-3 text-[11px] uppercase tracking-[0.32em]">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-[0.32em]"
            title={isExporting ? 'Exporting...' : 'Export to Excel'}
          >
            <Download className="h-3 w-3" />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">Overview</span>
          <Link
            href="/hermes-5g/map"
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
                  value={filter}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                  singleRow
                />
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

          {renderMobileCard(progressCurveCard, 280)}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderMobileCard(dailyRunrateCard, 280)}
            {renderMobileCard(topIssueCard, 280)}
          </div>

          {renderMobileCard(nanoClusterCard, 200)}
          {renderMobileCard(newFeatureCard, 200)}
          {renderMobileCard(vendorLeaderboardCard, 280)}
        </section>
      </main>
    </div>
  )

  // Placeholder untuk komponen lain
  const placeholder = (title: string) => (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="flex-1 flex items-center justify-center text-white/50">
        {loading ? "Loading..." : "Coming soon"}
      </div>
    </div>
  )

  const initialLoaderMessage = !filterContext.isHydrated
    ? "Initializing filter preferences..."
    : "Retrieving latest Hermes 5G data..."

  if (!filterContext.isHydrated || !hasInitialDataLoaded) {
    return <HermesLoadingScreen message={initialLoaderMessage} />
  }

  // Conditional rendering based on mobile/desktop
  return hasMounted && isMobile ? (
    mobileLayout
  ) : (
    <Wallboard1080
      header={header}
      filterBar={filterBar}
      matrixStats={matrixStats}
      readinessCard={readinessCard}
      activatedCard={activatedCard}
      progressCurve={progressCurveCard}
      dailyRunrate={dailyRunrateCard}
      top5Issue={topIssueCard}
      nanoCluster={nanoClusterCard}
      newFeature={newFeatureCard}
      leaderboard={vendorLeaderboardCard}
    />
  )
}

"use client"

import Link from "next/link"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
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
import { useSiteData } from "@/hooks/useSiteData"
import { useFilter } from "@/contexts/FilterContext"
import { useMemo } from "react"
import { useTopIssueData } from "@/hooks/useTopIssueData"
import { useDailyRunrateData } from "@/hooks/useDailyRunrateData"
import { useVendorLeaderboard } from "@/hooks/useVendorLeaderboard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
// Debug overlays removed for production-like view

export default function Hermes5GPage() {
  // Menggunakan shared filter context
  const filterContext = useFilter()
  
  // Convert filter context to FilterValue format
  const currentFilter: FilterValue = useMemo(() => ({
    q: filterContext.searchTerm,
    vendor_name: filterContext.vendorFilter !== 'all' ? [filterContext.vendorFilter] : [],
    program_report: filterContext.programFilter !== 'all' ? [filterContext.programFilter] : [],
    imp_ttp: filterContext.cityFilter !== 'all' ? [filterContext.cityFilter] : [],
    nano_cluster: filterContext.nanoClusterFilter !== 'all' ? [filterContext.nanoClusterFilter] : []
  }), [filterContext.searchTerm, filterContext.vendorFilter, filterContext.programFilter, filterContext.cityFilter, filterContext.nanoClusterFilter])
  
  // Menggunakan hook useSiteData untuk mengambil data berdasarkan filter
  const { 
    rows, 
    loading, 
    error, 
    count, 
    filter, 
    updateFilter 
  } = useSiteData({ initialFilter: currentFilter })

  // Menggunakan hook useTopIssueData untuk mengambil data top 5 issue
  // Meneruskan filter yang sama dengan useSiteData
  const {
    data: topIssuesData,
    loading: topIssuesLoading,
    topIssuesTotal,
    totalIssues
  } = useTopIssueData({ filter })
  
  // Menggunakan hook useDailyRunrateData untuk mengambil data daily runrate
  // Meneruskan filter yang sama dengan useSiteData
  const {
    data: dailyRunrateData,
    loading: dailyRunrateLoading
  } = useDailyRunrateData({ filter })

  // Menggunakan hook useVendorLeaderboard untuk mengambil data vendor leaderboard
  // Meneruskan filter yang sama dengan useSiteData
  const {
    data: vendorLeaderboardData,
    loading: vendorLeaderboardLoading,
    totalVendors
  } = useVendorLeaderboard({ filter })

  const isMobile = useIsMobile()
  const [hasMounted, setHasMounted] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setHasMounted(true)
  }, [])

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
    filter.nano_cluster.length
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
    // Update filter context
    filterContext.setSearchTerm(newFilters.q)
    filterContext.setVendorFilter(newFilters.vendor_name.length > 0 ? newFilters.vendor_name[0] : 'all')
    filterContext.setProgramFilter(newFilters.program_report.length > 0 ? newFilters.program_report[0] : 'all')
    filterContext.setCityFilter(newFilters.imp_ttp.length > 0 ? newFilters.imp_ttp[0] : 'all')
    filterContext.setNanoClusterFilter(newFilters.nano_cluster.length > 0 ? newFilters.nano_cluster[0] : 'all')
    updateFilter(newFilters)
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
        let errorMessage = 'Gagal mengekspor data.'
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
        message: 'Data Activation berhasil diunduh.'
      })
    } catch (error) {
      console.error('Failed to export Hermes 5G data', error)
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat ekspor.'
      setExportStatus({
        type: 'error',
        message
      })
    } finally {
      setIsExporting(false)
    }
  }

  const renderExportControls = (extraClassName = '') => {
    const baseButtonClass = 'inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

    return (
      <div className={`flex flex-col gap-1 ${extraClassName}`}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleExport}
            className={`${baseButtonClass} border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20`}
            disabled={isExporting}
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Mengunduh...' : 'Export Activation'}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="text-white/60">File will follow the applied filters.</span>
          {exportStatus && (
            <span className={exportStatus.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}>{exportStatus.message}</span>
          )}
        </div>
      </div>
    )
  }

  // Header component
  const header = (
    <div className="flex items-center justify-between h-full w-full px-4">
      {/* Back button dan Logo Indosat di kiri */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Back Button */}
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center justify-center w-8 h-8 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-full transition-all duration-200 group -ml-9 mt-3"
        >
          <svg 
            className="w-4 h-4 text-white group-hover:text-white/90 transition-colors" 
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
        
        {/* Logo Indosat */}
        <img 
          src="/logo indosat putih.png" 
          alt="Indosat Logo" 
          className="h-8" 
        />
      </div>
      
      {/* Judul di tengah */}
      <div className="flex-grow text-center">
        <h1 className="text-3xl font-bold text-white tracking-wide">DASHBOARD HERMES H2 2025</h1>
      </div>
      
      {/* Tanggal hari ini */}
      <div className="flex-shrink-0 -mr-9 mt-2 flex flex-col items-end gap-2 text-right">
        <div className="text-sm font-medium text-white">
          {formattedDate}
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em]">
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">Overview</span>
          <Link
            href="/hermes-5g/map"
            className="rounded-full border border-white/20 px-3 py-1 font-medium text-white/80 transition hover:bg-white/10"
          >
            Map
          </Link>
        </div>
      </div>
      </div>
  )

  // FilterBar component
  const filterBar = (
    <div className="flex h-full flex-col gap-3">
      <FilterBar
        value={filter}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
      />
      {renderExportControls()}
    </div>
  )

  // MatrixStats component
  const matrixStats = (
    <MatrixStatsCard rows={rows} />
  )

  // 5G Readiness component
  const readinessCard = (
    <FiveGReadinessCard rows={rows} maxCities={10} />
  )

  // 5G Activated component
  const activatedCard = (
    <FiveGActivatedCard rows={rows} maxCities={10} />
  )

  // Nano Cluster component
  const nanoClusterCard = (
    <NanoClusterCard rows={rows} />
  )

  // Progress Curve component
  const progressCurveCard = (
    <ProgressCurveLineChart rows={rows} anchorDate={new Date().toISOString()} monthsSpan={3} />
  )
  

  // Daily Runrate component
  const dailyRunrateCard = (
    <DailyRunrateCard 
      data={dailyRunrateData} 
      isLoading={dailyRunrateLoading} 
    />
  )

  // TopIssueCard component
  const topIssueCard = (
    <TopIssueCard 
      issues={topIssuesData} 
      totalIssues={totalIssues} 
      topIssuesTotal={topIssuesTotal}
      isLoading={topIssuesLoading}
    />
  )

  // Vendor Leaderboard component
  const vendorLeaderboardCard = (
    <VendorLeaderboardCard 
      rows={rows}
      isLoading={vendorLeaderboardLoading}
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
              src="/logo indosat putih.png"
              alt="Indosat Logo"
              className="h-8"
            />
          </div>

          <div className="flex-1 text-right text-[11px] leading-tight text-white/80">
            <div className="font-medium">{formattedDate}</div>
          </div>
        </div>

        <h1 className="mt-4 text-center text-xl font-semibold tracking-wide text-white">
          DASHBOARD HERMES H2 2025
        </h1>
        <div className="mt-3 flex justify-center gap-3 text-[11px] uppercase tracking-[0.32em]">
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
                />
                {renderExportControls('mt-3')}
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

          {renderMobileCard(nanoClusterCard, 240)}
          {renderMobileCard(vendorLeaderboardCard, 320)}
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

  // Show loading state until hydration is complete
  if (!filterContext.isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </div>
    )
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
      leaderboard={vendorLeaderboardCard}
    />
  )
}

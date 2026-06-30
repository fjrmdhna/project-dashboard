"use client"

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { Building2, ChevronDown, Download, SlidersHorizontal, Users } from "lucide-react"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { DashboardExportButton, downloadExportResponse } from "@/components/dashboard/DashboardExportButton"
import { DashboardLoadingScreen } from "@/components/dashboard/DashboardLoadingScreen"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { CafStatusAssigneeGrid } from "@/components/cards/CafStatusAssigneeGrid"
import { CafStatusVendorFollowupCard } from "@/components/cards/CafStatusVendorFollowupCard"
import { CafAfCompleteStatusCard } from "@/components/cards/CafAfCompleteStatusCard"
import { CafVendorTopCard } from "@/components/cards/CafVendorTopCard"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { CafFilterBar, getInitialCafFilters } from "@/components/filters/CafFilterBar"
import { CafWallboard } from "@/layouts/CafWallboard"
import { useCafDashboard } from "@/hooks/useCafDashboard"
import { useDashboardScrollLayout } from "@/hooks/useDashboardScrollLayout"
import { CAF_WALLBOARD_PANELS } from "@/config/caf-wallboard-panels"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"

function countActiveCafFilterGroups(filters: CafSiteFilters): number {
  let count = 0
  if (filters.q?.trim()) count += 1
  if ((filters.project_name?.length ?? 0) > 0) count += 1
  if ((filters.caf_status?.length ?? 0) > 0) count += 1
  if ((filters.vendor_tlp_name?.length ?? 0) > 0) count += 1
  if ((filters.vendor_requestor_name?.length ?? 0) > 0) count += 1
  if ((filters.caf_type?.length ?? 0) > 0) count += 1
  if ((filters.avp?.length ?? 0) > 0) count += 1
  if ((filters.rfs_year?.length ?? 0) > 0) count += 1
  return count
}

export default function CafMonitoringPage() {
  const [filters, setFilters] = useState<CafSiteFilters>(getInitialCafFilters)
  const [isExporting, setIsExporting] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const isScrollLayout = useDashboardScrollLayout()

  useEffect(() => {
    if (!isScrollLayout) {
      setIsMobileFilterOpen(false)
    }
  }, [isScrollLayout])

  const {
    hasData,
    totalCaf,
    inReview,
    approved,
    implemented,
    rejected,
    notConfirmed,
    resubmit,
    funnelTotal,
    statusAssigneeCards,
    statusVendorPending,
    pendingFollowupTotal,
    runrateData,
    topVendorRequestor,
    topVendorTlp,
    afCompleteStatus,
    loading,
    error,
  } = useCafDashboard(filters)

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const activeFilterCount = useMemo(() => countActiveCafFilterGroups(filters), [filters])
  const hasActiveFilters = activeFilterCount > 0

  useEffect(() => {
    setHasMounted(true)
  }, [])

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
      const params = new URLSearchParams(cafFiltersToQueryString(filters))
      const response = await fetch(`/api/caf/export?${params.toString()}`)
      await downloadExportResponse(response, "caf-export.xlsx")
    } catch (error) {
      console.error("Failed to export CAF data", error)
    } finally {
      setIsExporting(false)
    }
  }, [filters])

  const handleFilterReset = useCallback(() => {
    setFilters(getInitialCafFilters())
  }, [])

  const renderMobileCard = (card: ReactNode, minHeight?: number) => {
    const style: CSSProperties = minHeight ? { minHeight, height: minHeight } : {}
    return (
      <div className="w-full flex flex-col" style={style}>
        {card}
      </div>
    )
  }

  if (loading && !hasData) {
    return (
      <DashboardLoadingScreen
        label="CAF Monitoring"
        message="Retrieving latest CAF pipeline data..."
        placeholders={["CAF Pipeline", "Status Breakdown", "AF Complete", "Daily Runrate"]}
      />
    )
  }

  const cafStats = {
    totalSites: totalCaf,
    inReview,
    approved,
    implemented,
    rejected,
    notConfirmed,
    resubmit,
  }

  const matrixStatsWallboard = (
    <MatrixStatsCard variant="caf" rows={[]} stats={cafStats} layout="default" />
  )

  const matrixStatsMobile = (
    <MatrixStatsCard variant="caf" rows={[]} stats={cafStats} layout="mobile" />
  )

  const afCompleteStatusWallboard = (
    <CafAfCompleteStatusCard
      data={afCompleteStatus}
      isLoading={false}
      error={error}
      layout="wallboard"
    />
  )

  const afCompleteStatusMobile = (
    <CafAfCompleteStatusCard
      data={afCompleteStatus}
      isLoading={false}
      error={error}
      layout="mobile"
    />
  )

  const statusAssigneeGridWallboard = (
    <CafStatusAssigneeGrid
      cards={statusAssigneeCards}
      isLoading={false}
      error={error}
      layout="wallboard"
    />
  )

  const statusAssigneeGridMobile = (
    <CafStatusAssigneeGrid
      cards={statusAssigneeCards}
      isLoading={false}
      error={error}
      layout="mobile"
    />
  )

  const dailyRunrateCardWallboard = (
    <DailyRunrateCard
      data={runrateData}
      isLoading={false}
      compact
      title="Daily CAF Runrate – Last 7 Days"
      titleClassName="caf-subtitle rounded-full bg-blue-500/20 text-blue-300 px-1.5 py-0.5 text-[9px]"
      seriesLabels={{ forecast: "Created", actual: "Approved" }}
      hidePointLabels
    />
  )

  const dailyRunrateCardMobile = (
    <DailyRunrateCard
      data={runrateData}
      isLoading={false}
      title="Daily CAF Runrate – Last 7 Days"
      seriesLabels={{ forecast: "Created", actual: "Approved" }}
    />
  )

  const vendorRanCard =
    CAF_WALLBOARD_PANELS.vendorRan ? (
      <CafVendorTopCard
        title="Top 5 RAN Vendor – Pipeline Mix"
        items={topVendorRequestor}
        totalCaf={funnelTotal}
        icon={Users}
        iconClassName="bg-violet-500/20 text-violet-300"
        titleClassName="text-violet-200"
        badgeClassName="bg-violet-500/10 text-violet-200"
        error={error}
      />
    ) : null

  const vendorTlpCard =
    CAF_WALLBOARD_PANELS.vendorTlp ? (
      <CafVendorTopCard
        title="Top 5 TLP Vendor – Pipeline Mix"
        items={topVendorTlp}
        totalCaf={funnelTotal}
        icon={Building2}
        iconClassName="bg-teal-500/20 text-teal-300"
        titleClassName="text-teal-200"
        badgeClassName="bg-teal-500/10 text-teal-200"
        error={error}
      />
    ) : null

  const statusVendorFollowupCard =
    CAF_WALLBOARD_PANELS.statusVendorFollowup ? (
      <CafStatusVendorFollowupCard
        items={statusVendorPending}
        pendingTotal={pendingFollowupTotal}
        isLoading={false}
        error={error}
      />
    ) : null

  const header = (
    <ProgramHeader
      title="CAF Monitoring Dashboard"
      dateLabel={formattedDate}
      exportButton={
        <DashboardExportButton onClick={handleExport} isExporting={isExporting} />
      }
    />
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
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20 transition"
              aria-label="Back to home"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          CAF Monitoring Dashboard
        </h1>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            title={isExporting ? "Exporting..." : "Export to Excel"}
          >
            <Download className="h-3 w-3" />
            {isExporting ? "Exporting..." : "Export"}
          </button>
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
                <CafFilterBar
                  variant="stacked"
                  value={filters}
                  onChange={setFilters}
                  onReset={handleFilterReset}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="caf-mobile-layout__cards px-4 pt-4 pb-8 space-y-4">
          {renderMobileCard(matrixStatsMobile)}
          {renderMobileCard(afCompleteStatusMobile)}
          {renderMobileCard(dailyRunrateCardMobile, 220)}
          {renderMobileCard(statusAssigneeGridMobile)}
          {statusVendorFollowupCard ? renderMobileCard(statusVendorFollowupCard, 260) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {vendorRanCard ? renderMobileCard(vendorRanCard, 280) : null}
            {vendorTlpCard ? renderMobileCard(vendorTlpCard, 280) : null}
          </div>
        </section>
      </main>
    </div>
  )

  const wallboardView = (
    <CafWallboard
      header={header}
      filterBar={
        <CafFilterBar
          value={filters}
          onChange={setFilters}
          onReset={handleFilterReset}
        />
      }
      matrixStats={matrixStatsWallboard}
      afCompleteStatus={afCompleteStatusWallboard}
      statusAssigneeGrid={statusAssigneeGridWallboard}
      statusVendorFollowup={statusVendorFollowupCard ?? undefined}
      dailyRunrate={dailyRunrateCardWallboard}
      vendorRan={vendorRanCard ?? undefined}
      vendorTlp={vendorTlpCard ?? undefined}
    />
  )

  return (
    <>
      {hasMounted && isScrollLayout ? mobileLayout : wallboardView}
    </>
  )
}


"use client"

import { useState } from "react"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { DashboardLoadingScreen } from "@/components/dashboard/DashboardLoadingScreen"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { CafStatusFunnelCard } from "@/components/cards/CafStatusFunnelCard"
import { CafAgingCard } from "@/components/cards/CafAgingCard"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { CafFilterBar, getInitialCafFilters } from "@/components/filters/CafFilterBar"
import { CafWallboard } from "@/layouts/CafWallboard"
import { useCafDashboard } from "@/hooks/useCafDashboard"
import type { CafSiteFilters } from "@/lib/caf-filters"

export default function CafMonitoringPage() {
  const [filters, setFilters] = useState<CafSiteFilters>(getInitialCafFilters)

  const {
    hasData,
    totalCaf,
    inReview,
    approved,
    implemented,
    rejected,
    notConfirmed,
    resubmit,
    statusItems,
    funnelTotal,
    buckets,
    waitingImplementation,
    pendingAging,
    totalOpen,
    runrateData,
    loading,
    error,
  } = useCafDashboard(filters)

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  if (loading && !hasData) {
    return (
      <DashboardLoadingScreen
        label="CAF Monitoring"
        message="Retrieving latest CAF pipeline data..."
        placeholders={["CAF Pipeline", "Status Funnel", "CAF Aging"]}
      />
    )
  }

  const header = (
    <ProgramHeader title="CAF Monitoring Dashboard" dateLabel={formattedDate} />
  )

  const matrixStats = (
    <MatrixStatsCard
      variant="caf"
      rows={[]}
      stats={{
        totalSites: totalCaf,
        inReview,
        approved,
        implemented,
        rejected,
        notConfirmed,
        resubmit,
      }}
    />
  )

  const statusFunnelCard = (
    <CafStatusFunnelCard
      items={statusItems}
      totalCaf={funnelTotal}
      isLoading={false}
      error={error}
    />
  )

  const dailyRunrateCard = (
    <DailyRunrateCard
      data={runrateData}
      isLoading={false}
      title="Daily CAF Runrate – Last 7 Days"
      titleClassName="caf-subtitle rounded-full bg-blue-500/20 text-blue-300 px-1.5 py-0.5"
      seriesLabels={{ forecast: "Created", actual: "Approved" }}
    />
  )

  const agingCard = (
    <CafAgingCard
      buckets={buckets}
      waitingImplementation={waitingImplementation}
      pendingAging={pendingAging}
      totalOpen={totalOpen}
      isLoading={false}
      error={error}
    />
  )

  return (
    <CafWallboard
      header={header}
      filterBar={
        <CafFilterBar
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters(getInitialCafFilters())}
        />
      }
      matrixStats={matrixStats}
      statusFunnel={statusFunnelCard}
      aging={agingCard}
      dailyRunrate={dailyRunrateCard}
    />
  )
}

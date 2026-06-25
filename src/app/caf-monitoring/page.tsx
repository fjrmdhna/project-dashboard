"use client"

import { useState } from "react"
import { Building2, Users } from "lucide-react"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { DashboardLoadingScreen } from "@/components/dashboard/DashboardLoadingScreen"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { CafStatusFunnelCard } from "@/components/cards/CafStatusFunnelCard"
import { CafAgingCard } from "@/components/cards/CafAgingCard"
import { CafMilestoneAlignmentCard } from "@/components/cards/CafMilestoneAlignmentCard"
import { CafVendorTopCard } from "@/components/cards/CafVendorTopCard"
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
    topVendorRequestor,
    topVendorTlp,
    milestoneAlignment,
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
        placeholders={["CAF Pipeline", "Status Funnel", "Vendor Leaderboard"]}
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

  const milestoneAlignmentCard = (
    <CafMilestoneAlignmentCard
      data={milestoneAlignment}
      isLoading={false}
      error={error}
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
      hidePointLabels
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

  const vendorRanCard = (
    <CafVendorTopCard
      title="Top 5 RAN Vendor"
      items={topVendorRequestor}
      totalCaf={funnelTotal}
      icon={Users}
      iconClassName="bg-violet-500/20 text-violet-300"
      titleClassName="text-violet-200"
      badgeClassName="bg-violet-500/10 text-violet-200"
      barColor="#A78BFA"
      error={error}
    />
  )

  const vendorTlpCard = (
    <CafVendorTopCard
      title="Top 5 TLP Vendor"
      items={topVendorTlp}
      totalCaf={funnelTotal}
      icon={Building2}
      iconClassName="bg-teal-500/20 text-teal-300"
      titleClassName="text-teal-200"
      badgeClassName="bg-teal-500/10 text-teal-200"
      barColor="#2DD4BF"
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
      milestoneAlignment={milestoneAlignmentCard}
      statusFunnel={statusFunnelCard}
      aging={agingCard}
      dailyRunrate={dailyRunrateCard}
      vendorRan={vendorRanCard}
      vendorTlp={vendorTlpCard}
    />
  )
}

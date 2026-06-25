"use client"

import { useCallback, useState } from "react"
import { Building2, Users } from "lucide-react"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { DashboardExportButton, downloadExportResponse } from "@/components/dashboard/DashboardExportButton"
import { DashboardLoadingScreen } from "@/components/dashboard/DashboardLoadingScreen"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { CafStatusAssigneeGrid } from "@/components/cards/CafStatusAssigneeGrid"
import { CafStatusVendorFollowupCard } from "@/components/cards/CafStatusVendorFollowupCard"
import { CafMilestoneAlignmentCard } from "@/components/cards/CafMilestoneAlignmentCard"
import { CafVendorTopCard } from "@/components/cards/CafVendorTopCard"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { CafFilterBar, getInitialCafFilters } from "@/components/filters/CafFilterBar"
import { CafWallboard } from "@/layouts/CafWallboard"
import { useCafDashboard } from "@/hooks/useCafDashboard"
import { CAF_WALLBOARD_PANELS } from "@/config/caf-wallboard-panels"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"

export default function CafMonitoringPage() {
  const [filters, setFilters] = useState<CafSiteFilters>(getInitialCafFilters)
  const [isExporting, setIsExporting] = useState(false)

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

  if (loading && !hasData) {
    return (
      <DashboardLoadingScreen
        label="CAF Monitoring"
        message="Retrieving latest CAF pipeline data..."
        placeholders={["CAF Pipeline", "Status Breakdown", "Daily Runrate"]}
      />
    )
  }

  const header = (
    <ProgramHeader
      title="CAF Monitoring Dashboard"
      dateLabel={formattedDate}
      exportButton={
        <DashboardExportButton onClick={handleExport} isExporting={isExporting} />
      }
    />
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

  const statusAssigneeGrid = (
    <CafStatusAssigneeGrid
      cards={statusAssigneeCards}
      isLoading={false}
      error={error}
    />
  )

  const dailyRunrateCard = (
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
      statusAssigneeGrid={statusAssigneeGrid}
      statusVendorFollowup={
        CAF_WALLBOARD_PANELS.statusVendorFollowup ? (
          <CafStatusVendorFollowupCard
            items={statusVendorPending}
            pendingTotal={pendingFollowupTotal}
            isLoading={false}
            error={error}
          />
        ) : undefined
      }
      dailyRunrate={dailyRunrateCard}
      vendorRan={
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
        ) : undefined
      }
      vendorTlp={
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
        ) : undefined
      }
    />
  )
}

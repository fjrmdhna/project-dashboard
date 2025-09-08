"use client"

import { Loader2 } from 'lucide-react'
import { ReadinessChart } from "@/components/readiness-chart"
import { ActivatedChart } from "@/components/activated-chart"
import { CompactDailyRunrate } from "@/components/CompactDailyRunrate"
import { CompactDataAlignment } from "@/components/CompactDataAlignment"
import { CompactTop5Issues } from "@/components/CompactTop5Issues"
import { CompactNanoCluster } from "@/components/CompactNanoCluster"
import { Hermes5GFilterSection } from "@/components/Hermes5GFilterSection"
import { Hermes5GDataTable } from "@/components/Hermes5GDataTable"
import { VendorLeaderboard } from "@/components/VendorLeaderboard"
import { DashboardHeader } from "@/components/DashboardHeader"
import { SidebarCharts } from "@/components/SidebarCharts"
import { MetricsRow } from "@/components/MetricsRow"
import { CompactLeaderboard } from "@/components/CompactLeaderboard"
import { CompactFilterSection } from "@/components/CompactFilterSection"
import { useHermes5GContext } from '@/contexts/Hermes5GContext'
import { useVendorLeaderboard } from '@/hooks/useVendorLeaderboard'

export default function HermesPage() {
  const {
    // Filters
    filters,
    filterOptions,
    setSearchTerm,
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    resetFilters,
    
    // Chart Data
    chartData,
    chartLoading,
    refreshAllCharts,
    
    // Site Data
    stats,
    sites,
    siteLoading,
    pagination,
    refreshSiteData,
    
    // Combined actions
    refreshAll
  } = useHermes5GContext()

  // Vendor Leaderboard
  const {
    vendors: leaderboardVendors,
    loading: leaderboardLoading,
    updateFTR
  } = useVendorLeaderboard()

  // Transform chart data for sidebar
  const sidebarReadinessData = chartData.readinessChartData.map(item => ({
    location: item.location,
    nyValue: item.nyReadiness,
    currentValue: item.readiness
  }))

  const sidebarActivatedData = chartData.activatedChartData.map(item => ({
    location: item.location,
    nyValue: item.nyActivated,
    currentValue: item.activated
  }))

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <DashboardHeader />

      {/* Main Layout */}
      <div className="flex">
        {/* Left Sidebar */}
        <SidebarCharts 
          readinessData={sidebarReadinessData}
          activatedData={sidebarActivatedData}
        />

        {/* Main Content Area */}
        <div className="flex-1 p-2 space-y-2">
          {/* Filters Section */}
          <CompactFilterSection
            filters={{
              searchTerm: filters.searchTerm,
              vendorFilter: filters.vendorFilter,
              programFilter: filters.programFilter,
              cityFilter: filters.cityFilter
            }}
            filterOptions={filterOptions}
            onSearchChange={setSearchTerm}
            onVendorChange={setVendorFilter}
            onProgramChange={setProgramFilter}
            onCityChange={setCityFilter}
            onResetFilters={resetFilters}
            loading={siteLoading}
          />

          {/* Metrics Row */}
          <MetricsRow stats={stats} loading={siteLoading} />

          {/* Charts Grid Layout */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Nano Cluster */}
            <CompactNanoCluster data={chartData.nanoClusterData} />
          </div>

          {/* Bottom Row: Daily Runrate + Top Issues + Data Alignment + Leaderboard */}
          <div className="grid grid-cols-4 gap-2">
            {/* Daily Runrate */}
            <CompactDailyRunrate data={chartData.dailyRunrateData} />

            {/* Top 5 Issues */}
            <CompactTop5Issues 
              data={chartData.top5IssueData} 
              top5Count={chartData.top5IssueStats.top5Count}
              totalCount={chartData.top5IssueStats.totalCount}
            />

            {/* Data Alignment */}
            <CompactDataAlignment data={chartData.dataAlignmentData} />

            {/* Compact Leaderboard */}
            <CompactLeaderboard 
              vendors={leaderboardVendors}
              loading={leaderboardLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 
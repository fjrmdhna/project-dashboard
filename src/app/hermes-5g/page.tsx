"use client"

import { useState } from "react"
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
import { useTopIssueData } from "@/hooks/useTopIssueData"
import { useDailyRunrateData } from "@/hooks/useDailyRunrateData"
import { useVendorLeaderboard } from "@/hooks/useVendorLeaderboard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
// Debug overlays removed for production-like view

export default function Hermes5GPage() {
  // Menggunakan hook useSiteData untuk mengambil data berdasarkan filter
  const { 
    rows, 
    loading, 
    error, 
    count, 
    filter, 
    updateFilter 
  } = useSiteData()

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

  // Handler untuk perubahan filter
  const handleFilterChange = (newFilters: FilterValue) => {
    console.log("Filter changed:", newFilters)
    updateFilter(newFilters)
  }

  // Handler untuk reset filter
  const handleFilterReset = () => {
    console.log("Filters reset")
    // Reset sudah ditangani di FilterBar component
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
      <div className="flex-shrink-0 text-right -mr-9 mt-2">
        <div className="text-sm font-medium text-white">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>
            </div>
  )

  // FilterBar component
  const filterBar = (
    <div className="h-full">
      <FilterBar 
        value={filter}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
                  />
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

  // Placeholder untuk komponen lain
  const placeholder = (title: string) => (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="flex-1 flex items-center justify-center text-white/50">
        {loading ? "Loading..." : "Coming soon"}
      </div>
    </div>
  )

  return (
    <>
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
      {/* Debug overlays removed */}
    </>
  )
} 

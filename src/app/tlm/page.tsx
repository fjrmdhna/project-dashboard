"use client"

import { useMemo, useState, type ReactNode } from "react"

import { FilterBar, type FilterValue } from "@/components/filters/FilterBar"
import { MatrixStatsCard, type Row as MatrixRow } from "@/components/cards/MatrixStatsCard"
import { FiveGReadinessCard } from "@/components/cards/FiveGReadinessCard"
import { FiveGActivatedCard } from "@/components/cards/FiveGActivatedCard"
import ProgressCurveLineChart from "@/components/charts/ProgressCurveLineChart"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { TopIssueCard } from "@/components/cards/TopIssueCard"
import { NanoClusterCard } from "@/components/cards/NanoClusterCard"
import { NanoClusterListCard } from "@/components/cards/NewFeatureCard"
import { VendorLeaderboardCard } from "@/components/cards/VendorLeaderboardCard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { DailyRunrateItem } from "@/hooks/useDailyRunrateData"
import type { TopIssue } from "@/hooks/useTopIssueData"

type DashboardRow = MatrixRow & {
  nano_cluster?: string | null
  mocn_activation_forecast?: string | null
}

const DASHBOARD_ROWS: DashboardRow[] = [
  {
    system_key: "TLM-001",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "TLM Modernization Wave 1",
    imp_ttp: "Jakarta",
    nano_cluster: "Cluster Alpha",
    caf_approved: "2025-01-04",
    mos_af: "2025-01-11",
    ic_000040_af: "2025-01-20",
    imp_integ_af: "2025-01-28",
    rfs_forecast_lock: "2025-02-10",
    rfs_af: "2025-02-08",
    mocn_activation_forecast: "2025-01-25",
    endorse_af: "2025-02-15",
    lat: -6.2,
    long: 106.8
  },
  {
    system_key: "TLM-002",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "TLM Modernization Wave 1",
    imp_ttp: "Surabaya",
    nano_cluster: "Cluster Beta",
    caf_approved: "2025-01-12",
    mos_af: "2025-01-18",
    ic_000040_af: "2025-01-26",
    imp_integ_af: "2025-02-05",
    rfs_forecast_lock: "2025-02-20",
    rfs_af: null,
    mocn_activation_forecast: "2025-02-01",
    hotnews_af: "2025-02-07",
    lat: -7.3,
    long: 112.7
  },
  {
    system_key: "TLM-003",
    vendor_name: "Ericsson Indonesia",
    program_report: "TLM Modernization Wave 1",
    imp_ttp: "Bandung",
    nano_cluster: "Cluster Gamma",
    caf_approved: "2025-01-08",
    mos_af: "2025-01-14",
    ic_000040_af: "2025-01-22",
    imp_integ_af: "2025-02-02",
    rfs_forecast_lock: "2025-02-18",
    rfs_af: "2025-02-16",
    mocn_activation_forecast: "2025-01-28",
    endorse_af: "2025-02-22",
    lat: -6.9,
    long: 107.6
  },
  {
    system_key: "TLM-004",
    vendor_name: "ZTE Indonesia",
    program_report: "TLM Modernization Wave 2",
    imp_ttp: "Medan",
    nano_cluster: "Cluster Delta",
    caf_approved: "2025-01-18",
    mos_af: "2025-01-24",
    ic_000040_af: null,
    imp_integ_af: null,
    rfs_forecast_lock: "2025-03-05",
    rfs_af: null,
    mocn_activation_forecast: "2025-02-20",
    lat: 3.6,
    long: 98.7
  },
  {
    system_key: "TLM-005",
    vendor_name: "Samsung Electronics Indonesia",
    program_report: "TLM Modernization Wave 2",
    imp_ttp: "Makassar",
    nano_cluster: "Cluster Epsilon",
    caf_approved: "2025-01-15",
    mos_af: "2025-01-26",
    ic_000040_af: "2025-02-04",
    imp_integ_af: "2025-02-12",
    rfs_forecast_lock: "2025-03-01",
    rfs_af: null,
    mocn_activation_forecast: "2025-02-18",
    lat: -5.1,
    long: 119.4
  },
  {
    system_key: "TLM-006",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "TLM Modernization Wave 2",
    imp_ttp: "Semarang",
    nano_cluster: "Cluster Zeta",
    caf_approved: "2025-01-10",
    mos_af: "2025-01-17",
    ic_000040_af: "2025-01-25",
    imp_integ_af: "2025-02-03",
    rfs_forecast_lock: "2025-02-22",
    rfs_af: "2025-02-19",
    mocn_activation_forecast: "2025-01-30",
    endorse_af: "2025-02-25",
    lat: -6.97,
    long: 110.42
  },
  {
    system_key: "TLM-007",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "TLM Reinforcement",
    imp_ttp: "Denpasar",
    nano_cluster: "Cluster Eta",
    caf_approved: "2025-01-06",
    mos_af: "2025-01-15",
    ic_000040_af: "2025-01-23",
    imp_integ_af: "2025-02-06",
    rfs_forecast_lock: "2025-02-24",
    rfs_af: null,
    mocn_activation_forecast: "2025-02-05",
    lat: -8.65,
    long: 115.21
  },
  {
    system_key: "TLM-008",
    vendor_name: "Ericsson Indonesia",
    program_report: "TLM Reinforcement",
    imp_ttp: "Balikpapan",
    nano_cluster: "Cluster Theta",
    caf_approved: "2025-01-09",
    mos_af: "2025-01-20",
    ic_000040_af: "2025-01-29",
    imp_integ_af: "2025-02-08",
    rfs_forecast_lock: "2025-02-26",
    rfs_af: null,
    mocn_activation_forecast: "2025-02-10",
    hotnews_af: "2025-02-12",
    lat: -1.27,
    long: 116.83
  }
]

const DAILY_RUNRATE_PLACEHOLDER: DailyRunrateItem[] = [
  { date: "10-Feb-25", readiness: 8, activated: 5 },
  { date: "11-Feb-25", readiness: 10, activated: 6 },
  { date: "12-Feb-25", readiness: 12, activated: 7 },
  { date: "13-Feb-25", readiness: 9, activated: 8 },
  { date: "14-Feb-25", readiness: 11, activated: 9 },
  { date: "15-Feb-25", readiness: 13, activated: 10 },
  { date: "16-Feb-25", readiness: 12, activated: 11 }
]

const TOP_ISSUES_PLACEHOLDER: TopIssue[] = [
  { category: "Permit Approval Pending", count: 18, color: "#FF6B6B" },
  { category: "Power Connection Delay", count: 14, color: "#F7B267" },
  { category: "Material Shortage", count: 11, color: "#4ECDC4" },
  { category: "Access Restriction", count: 9, color: "#5DA3FA" },
  { category: "Backhaul Readiness", count: 6, color: "#C792EA" }
]

const INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  ran_score: [],
  status: []
}

export default function TLMPage() {
  const [filterValue, setFilterValue] = useState<FilterValue>(INITIAL_FILTER)
  const isMobile = useIsMobile()

  const rows = useMemo(() => DASHBOARD_ROWS, [])
  const topIssuesTotal = useMemo(
    () => TOP_ISSUES_PLACEHOLDER.reduce((total, issue) => total + issue.count, 0),
    []
  )
  const totalIssues = topIssuesTotal + 12

  const totalSites = rows.length
  const readinessCount = rows.filter(row => row.imp_integ_af).length
  const activatedCount = rows.filter(row => row.rfs_af).length

  const handleFilterChange = (value: FilterValue) => {
    setFilterValue(value)
  }

  const handleFilterReset = () => {
    setFilterValue(INITIAL_FILTER)
  }

  const filterPanel = (
    <div className="flex h-full flex-col gap-3">
      <FilterBar value={filterValue} onChange={handleFilterChange} onReset={handleFilterReset} />
      <p className="text-[10px] text-white/50">
        Placeholder dataset. Supabase-backed queries will replace these values once integration is complete.
      </p>
    </div>
  )

  const matrixStats = <MatrixStatsCard rows={rows} patpCount={4} />
  const readinessCard = <FiveGReadinessCard rows={rows} maxCities={8} />
  const activatedCard = <FiveGActivatedCard rows={rows} maxCities={8} />
  const nanoClusterCard = <NanoClusterCard rows={rows} />
  const progressCurve = (
    <ProgressCurveLineChart rows={rows} anchorDate={new Date().toISOString()} monthsSpan={3} />
  )
  const dailyRunrate = <DailyRunrateCard data={DAILY_RUNRATE_PLACEHOLDER} />
  const topIssueCard = (
    <TopIssueCard
      issues={TOP_ISSUES_PLACEHOLDER}
      totalIssues={totalIssues}
      topIssuesTotal={topIssuesTotal}
    />
  )
  const nanoClusterList = <NanoClusterListCard rows={rows} />
  const leaderboard = <VendorLeaderboardCard rows={rows} />

  const wallboardView = (
    <Wallboard1080
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

  const renderMobileCard = (node: ReactNode, minHeight?: number) => (
    <div className="w-full" style={minHeight ? { minHeight, height: minHeight } : undefined}>
      {node}
    </div>
  )

  const mobileLayout = (
    <div className="flex min-h-screen flex-col bg-[#050B1B] text-white">
      <main className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-6">
        <div className="rounded-2xl border border-white/10 bg-[#0F1630]/80 p-3">
          <FilterBar value={filterValue} onChange={handleFilterChange} onReset={handleFilterReset} />
          <p className="mt-2 text-[11px] text-white/50">
            Placeholder data shown. Integration with live TLM feeds is in progress.
          </p>
        </div>

        {renderMobileCard(matrixStats)}
        {renderMobileCard(readinessCard, 260)}
        {renderMobileCard(activatedCard, 260)}
        {renderMobileCard(progressCurve, 300)}

        <div className="grid gap-4 sm:grid-cols-2">
          {renderMobileCard(dailyRunrate, 260)}
          {renderMobileCard(topIssueCard, 260)}
        </div>

        {renderMobileCard(nanoClusterCard)}
        {renderMobileCard(nanoClusterList)}
        {renderMobileCard(leaderboard, 320)}
      </main>
    </div>
  )

  return isMobile ? mobileLayout : wallboardView
}

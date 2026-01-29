"use client"

import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { useHermes5GFilters } from '@/hooks/useHermes5GFilters'
import { useHermes5GDataOptimized } from '@/hooks/useHermes5GDataOptimized'
import { useHermes5GSiteData } from '@/hooks/useHermes5GSiteData'

// Types
interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
}

interface FilterState {
  searchTerm: string
  statusFilter: string
  regionFilter: string
  vendorFilter: string
  programFilter: string
  cityFilter: string
}

interface ChartFilters {
  vendorFilter: string
  programFilter: string
  cityFilter: string
  searchFilter?: string
}

interface TableFilters {
  search: string
  status: string
  region: string
  vendor: string
}

interface SiteData5G {
  system_key: string
  site_id: string
  site_name: string
  vendor_name: string
  site_status: string
  region: string
  year: string
  program_name: string
  "SBOQ.project_type": string
  vendor_code: string
  "5g_readiness_date": string | null
  "5g_activation_date": string | null
  cx_acceptance_status: string
  long: number | null
  lat: number | null
  created_at: string
  site_category?: string
  scope_of_work?: string
  region_wise?: string
  region_circle?: string
}

interface PaginationInfo {
  currentPage: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface StatsData {
  total: number
  scope: number
  caf: number
  mos: number
  installation: number
  fiveGReadiness: number
  fiveGActivation: number
  rfc: number
  endorse: number
  hotnews: number
  pac: number
  clusterAtp: number
}

interface ChartData {
  readinessChartData: any[]
  activatedChartData: any[]
  progressCurveData: any[]
  dailyRunrateData: any[]
  dataAlignmentData: any | null
  top5IssueData: any[]
  top5IssueStats: { top5Count: number; totalCount: number }
  nanoClusterData: any | null
}

// Context Type
interface Hermes5GContextType {
  // Filter State
  filters: FilterState
  filterOptions: FilterOptions
  chartFilters: ChartFilters
  tableFilters: TableFilters
  
  // Filter Actions
  setSearchTerm: (value: string) => void
  setStatusFilter: (value: string) => void
  setRegionFilter: (value: string) => void
  setVendorFilter: (value: string) => void
  setProgramFilter: (value: string) => void
  setCityFilter: (value: string) => void
  resetFilters: () => void
  
  // Chart Data
  chartData: ChartData
  chartLoading: {
    readiness: boolean
    activated: boolean
    progressCurve: boolean
    dailyRunrate: boolean
    dataAlignment: boolean
    top5Issue: boolean
    nanoCluster: boolean
  }
  refreshAllCharts: () => void
  refreshChart: (chartName: keyof ChartData) => void
  
  // Site Data
  sites: SiteData5G[]
  pagination: PaginationInfo | null
  stats: StatsData | null
  totalRecords: number
  siteLoading: boolean
  currentPage: number
  pageSize: number
  fetchSiteData: (page?: number, filters?: TableFilters) => void
  handlePageChange: (page: number) => void
  refreshSiteData: () => void
  setCurrentPage: (page: number) => void
  
  // Global Actions
  refreshAll: () => void
}

// Create Context
const Hermes5GContext = createContext<Hermes5GContextType | undefined>(undefined)

// Provider Props
interface Hermes5GProviderProps {
  children: ReactNode
}

// Map hermesAggregated to legacy ChartData shape (no legacy chart API calls)
function aggregatedToChartData(aggregated: ReturnType<typeof useHermes5GDataOptimized>['aggregated']): ChartData {
  if (!aggregated) {
    return {
      readinessChartData: [],
      activatedChartData: [],
      progressCurveData: [],
      dailyRunrateData: [],
      dataAlignmentData: null,
      top5IssueData: [],
      top5IssueStats: { top5Count: 0, totalCount: 0 },
      nanoClusterData: null
    }
  }
  const readinessChartData = Array.from(aggregated.byCity.entries()).map(([city, d]) => ({
    city,
    total: d.total,
    ready: d.ready,
    activated: d.activated
  }))
  const activatedChartData = Array.from(aggregated.byCity.entries()).map(([city, d]) => ({
    city,
    total: d.total,
    ready: d.ready,
    activated: d.activated
  }))
  const progressCurveData = Array.from(aggregated.progressCurve.byMonth.entries()).map(([month, d]) => ({
    month,
    ...d
  }))
  const nanoClusterData = Array.from(aggregated.byNanoCluster.entries()).map(([name, d]) => ({
    name,
    ...d
  }))
  return {
    readinessChartData,
    activatedChartData,
    progressCurveData,
    dailyRunrateData: aggregated.dailyRunrate,
    dataAlignmentData: null,
    top5IssueData: aggregated.topIssues.issues,
    top5IssueStats: {
      top5Count: aggregated.topIssues.top5Count,
      totalCount: aggregated.topIssues.totalCount
    },
    nanoClusterData: nanoClusterData.length ? nanoClusterData : null
  }
}

// Provider Component - uses hermesAggregated (no legacy chart endpoints)
export function Hermes5GProvider({ children }: Hermes5GProviderProps) {
  const filterHook = useHermes5GFilters()
  const chartFilters = filterHook.chartFilters
  const options = useMemo(() => ({
    vendorNames: chartFilters.vendorFilter && chartFilters.vendorFilter !== 'all' ? chartFilters.vendorFilter.split(',').filter(Boolean) : [],
    programReports: chartFilters.programFilter && chartFilters.programFilter !== 'all' ? chartFilters.programFilter.split(',').filter(Boolean) : [],
    impTtps: chartFilters.cityFilter && chartFilters.cityFilter !== 'all' ? chartFilters.cityFilter.split(',').filter(Boolean) : [],
    search: chartFilters.searchFilter || ''
  }), [chartFilters.vendorFilter, chartFilters.programFilter, chartFilters.cityFilter, chartFilters.searchFilter])
  const { aggregated, loading: chartDataLoading, refetch: refetchCharts } = useHermes5GDataOptimized(options)
  const siteDataHook = useHermes5GSiteData()

  const chartData = useMemo(() => aggregatedToChartData(aggregated), [aggregated])
  const chartLoading = {
    readiness: chartDataLoading,
    activated: chartDataLoading,
    progressCurve: chartDataLoading,
    dailyRunrate: chartDataLoading,
    dataAlignment: chartDataLoading,
    top5Issue: chartDataLoading,
    nanoCluster: chartDataLoading
  }

  const refreshAllCharts = useMemo(() => () => { refetchCharts() }, [refetchCharts])
  const refreshChart = useMemo(() => (_name: keyof ChartData) => { refetchCharts() }, [refetchCharts])

  const refreshAll = () => {
    siteDataHook.refreshData()
    refetchCharts()
  }

  const contextValue: Hermes5GContextType = {
    filters: filterHook.filters,
    filterOptions: filterHook.filterOptions,
    chartFilters: filterHook.chartFilters,
    tableFilters: filterHook.tableFilters,
    setSearchTerm: filterHook.setSearchTerm,
    setStatusFilter: filterHook.setStatusFilter,
    setRegionFilter: filterHook.setRegionFilter,
    setVendorFilter: filterHook.setVendorFilter,
    setProgramFilter: filterHook.setProgramFilter,
    setCityFilter: filterHook.setCityFilter,
    resetFilters: filterHook.resetFilters,
    chartData,
    chartLoading,
    refreshAllCharts,
    refreshChart,
    sites: siteDataHook.sites,
    pagination: siteDataHook.pagination,
    stats: siteDataHook.stats,
    totalRecords: siteDataHook.totalRecords,
    siteLoading: siteDataHook.loading,
    currentPage: siteDataHook.currentPage,
    pageSize: siteDataHook.pageSize,
    fetchSiteData: siteDataHook.fetchSiteData,
    handlePageChange: siteDataHook.handlePageChange,
    refreshSiteData: siteDataHook.refreshData,
    setCurrentPage: siteDataHook.setCurrentPage,
    refreshAll
  }

  return (
    <Hermes5GContext.Provider value={contextValue}>
      {children}
    </Hermes5GContext.Provider>
  )
}

// Custom Hook to use Context
export function useHermes5GContext(): Hermes5GContextType {
  const context = useContext(Hermes5GContext)
  
  if (context === undefined) {
    throw new Error('useHermes5GContext must be used within a Hermes5GProvider')
  }
  
  return context
}

// Export Context for advanced usage
export { Hermes5GContext } 
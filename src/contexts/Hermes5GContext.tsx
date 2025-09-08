"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useHermes5GFilters } from '@/hooks/useHermes5GFilters'
import { useHermes5GCharts } from '@/hooks/useHermes5GCharts'
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

// Provider Component
export function Hermes5GProvider({ children }: Hermes5GProviderProps) {
  // Use all hooks
  const filterHook = useHermes5GFilters()
  const chartHook = useHermes5GCharts(filterHook.chartFilters)
  const siteDataHook = useHermes5GSiteData()

  // Global refresh function
  const refreshAll = () => {
    siteDataHook.refreshData()
    chartHook.refreshAllCharts()
  }

  // Context value
  const contextValue: Hermes5GContextType = {
    // Filter State
    filters: filterHook.filters,
    filterOptions: filterHook.filterOptions,
    chartFilters: filterHook.chartFilters,
    tableFilters: filterHook.tableFilters,
    
    // Filter Actions
    setSearchTerm: filterHook.setSearchTerm,
    setStatusFilter: filterHook.setStatusFilter,
    setRegionFilter: filterHook.setRegionFilter,
    setVendorFilter: filterHook.setVendorFilter,
    setProgramFilter: filterHook.setProgramFilter,
    setCityFilter: filterHook.setCityFilter,
    resetFilters: filterHook.resetFilters,
    
    // Chart Data
    chartData: chartHook.chartData,
    chartLoading: chartHook.loading,
    refreshAllCharts: chartHook.refreshAllCharts,
    refreshChart: chartHook.refreshChart,
    
    // Site Data
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
    
    // Global Actions
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
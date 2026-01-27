"use client"

import { useMemo, useCallback, useRef } from 'react'
import type { Row as MatrixRow } from '@/components/cards/MatrixStatsCard'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'
import { format, subDays } from 'date-fns'
import { getProgramReportsForDisplayName, getDisplayNameForProgramReport } from '@/lib/hermes-program-mapping'

export interface Hermes5GSiteData extends MatrixRow {
  rfc_approved?: string | null
  pac_accepted_af?: string | null
  patp_accepted_af?: string | null
  imp_ttp?: string | null
  nano_cluster?: string | null
  ran_score?: string | null
  mocn_activation_forecast?: string | null  // Baseline for ProgressCurve
  rfs_bf?: string | null                    // Legacy baseline
  rfs_ff?: string | null
  year?: string | null
  region?: string | null
  issue_category?: string | null
}

export interface Hermes5GDataStats {
  totalSites: number
  caf: number
  mos: number
  install: number
  readiness: number
  activated: number
  rfc: number
  hotnews: number
  endorse: number
  pac: number
  patp: number
  nanoClusters: number
}

// Daily runrate item for chart
export interface DailyRunrateItem {
  date: string
  forecast: number
  actual: number
}

// Top issue item for chart
export interface TopIssueItem {
  category: string
  count: number
  color: string
}

// Pre-aggregated data for charts (prevents multiple iterations in each component)
export interface Hermes5GAggregatedData {
  // For FiveGReadinessCard & FiveGActivatedCard
  byCity: Map<string, { total: number; ready: number; activated: number }>
  byNanoCluster: Map<string, { total: number; ready: number; activated: number }>
  // For VendorLeaderboardCard
  byVendor: Map<string, { total: number; ready: number; activated: number; forecast: number }>
  // For ProgressCurveLineChart
  progressCurve: {
    totalBaseline: number
    totalForecast: number
    totalActual: number
    byMonth: Map<string, { baseline: number; forecast: number; actual: number }>
  }
  // For DailyRunrateCard (client-side calculated)
  dailyRunrate: DailyRunrateItem[]
  // For TopIssueCard (client-side calculated)
  topIssues: {
    issues: TopIssueItem[]
    top5Count: number
    totalCount: number
  }
}

export interface UseHermes5GDataReturn {
  data: Hermes5GSiteData[]
  stats: Hermes5GDataStats
  aggregated: Hermes5GAggregatedData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface UseHermes5GDataOptions {
  vendorNames?: string[]
  programReports?: string[]
  impTtps?: string[]
  nanoClusters?: string[]
  ranScores?: string[]
  years?: string[]
  regions?: string[]
  search?: string
  autoFetch?: boolean
}

// Default empty stats
const EMPTY_STATS: Hermes5GDataStats = {
  totalSites: 0,
  caf: 0,
  mos: 0,
  install: 0,
  readiness: 0,
  activated: 0,
  rfc: 0,
  hotnews: 0,
  endorse: 0,
  pac: 0,
  patp: 0,
  nanoClusters: 0
}

// Client-side filter function - much faster than API call
function filterDataClientSide(
  data: Hermes5GSiteData[],
  vendorNames: string[],
  programReports: string[],
  impTtps: string[],
  nanoClusters: string[],
  ranScores: string[],
  years: string[],
  regions: string[],
  search: string
): Hermes5GSiteData[] {
  if (!data || data.length === 0) return []
  
  // If no filters, return all data
  const hasFilters = vendorNames.length > 0 || programReports.length > 0 || 
                     impTtps.length > 0 || nanoClusters.length > 0 || 
                     ranScores.length > 0 || years.length > 0 || regions.length > 0 || search.length > 0
  
  if (!hasFilters) return data
  
  const searchLower = search.toLowerCase()
  
  // Expand display names to actual program_report values
  // Get all unique program_report values from data
  const allProgramReportsInData = [...new Set(data.map(row => row.program_report).filter((pr): pr is string => Boolean(pr)))]
  
  // Expand display names to program_report patterns
  const expandedProgramReports = new Set<string>()
  for (const programFilter of programReports) {
    // Check if it's a display name (mapped) or actual program_report
    const expanded = getProgramReportsForDisplayName(programFilter, allProgramReportsInData)
    if (expanded.length > 0) {
      // It's a display name, add all expanded program_reports
      expanded.forEach(pr => expandedProgramReports.add(pr))
    } else {
      // It's not a display name (unmapped), use as-is
      expandedProgramReports.add(programFilter)
    }
  }
  
  const expandedProgramReportsArray = Array.from(expandedProgramReports)
  
  let filteredCount = 0
  let rejectedByVendor = 0
  let rejectedByProgram = 0
  let rejectedByCity = 0
  let rejectedByCluster = 0
  let rejectedByRanScore = 0
  let rejectedByYear = 0
  let rejectedByRegion = 0
  let rejectedBySearch = 0
  
  const result = data.filter(row => {
    
    // Vendor filter
    if (vendorNames.length > 0 && !vendorNames.includes(row.vendor_name || '')) {
      rejectedByVendor++
      return false
    }
    
    // Program filter - use expanded program reports
    if (expandedProgramReportsArray.length > 0 && !expandedProgramReportsArray.includes(row.program_report || '')) {
      rejectedByProgram++
      return false
    }
    
    // City filter (imp_ttp)
    if (impTtps.length > 0 && !impTtps.includes(row.imp_ttp || '')) {
      rejectedByCity++
      return false
    }
    
    // Nano cluster filter
    if (nanoClusters.length > 0 && !nanoClusters.includes(row.nano_cluster || '')) {
      rejectedByCluster++
      return false
    }
    
    // RAN Score filter (case-insensitive)
    if (ranScores.length > 0) {
      const rowRanScore = (row.ran_score || '').toLowerCase().trim()
      const matchesRanScore = ranScores.some(rs => rowRanScore === rs.toLowerCase())
      if (!matchesRanScore) {
        rejectedByRanScore++
        return false
      }
    }
    
    // Year filter
    if (years.length > 0) {
      const rowYear = row.year || ''
      if (!rowYear || !years.includes(rowYear)) {
        rejectedByYear++
        return false
      }
    }
    
    // Region filter
    if (regions.length > 0 && !regions.includes(row.region || '')) {
      rejectedByRegion++
      return false
    }
    
    // Search filter
    if (searchLower) {
      const searchFields = [
        row.system_key,
        row.vendor_name,
        row.program_report
      ].filter(Boolean).map(s => (s || '').toLowerCase())
      
      const matchesSearch = searchFields.some(field => field.includes(searchLower))
      if (!matchesSearch) {
        rejectedBySearch++
        return false
      }
    }
    
    filteredCount++
    return true
  })
  
  return result
}

// Issue colors for top 5 issues
const ISSUE_COLORS = ['#FF6B6B', '#F7B267', '#4ECDC4', '#5DA3FA', '#C792EA']

// Excluded issue categories
const EXCLUDED_ISSUES = [
  'no issue',
  'caf ny submit', 
  '20. 5g activation done',
  '18c. 5g integration done'
]

// OPTIMIZATION: Single-pass aggregation for ALL chart components
// This prevents multiple O(n) iterations in each component
function aggregateDataSinglePass(data: Hermes5GSiteData[]): Hermes5GAggregatedData {
  const byCity = new Map<string, { total: number; ready: number; activated: number }>()
  const byNanoCluster = new Map<string, { total: number; ready: number; activated: number }>()
  const byVendor = new Map<string, { total: number; ready: number; activated: number; forecast: number }>()
  const byMonth = new Map<string, { baseline: number; forecast: number; actual: number }>()
  
  let totalBaseline = 0, totalForecast = 0, totalActual = 0
  
  // Daily runrate maps (last 7 days)
  const today = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i)
    return {
      dateKey: format(date, 'yyyy-MM-dd'),
      formatted: format(date, 'dd-MMM-yy')
    }
  })
  const dateSet = new Set(last7Days.map(d => d.dateKey))
  const forecastByDate = new Map<string, number>()
  const actualByDate = new Map<string, number>()
  
  // Issue category count
  const issueCount = new Map<string, number>()
  let totalIssueCount = 0
  
  // Single pass through all data
  for (const row of data) {
    // === City aggregation (for FiveGReadinessCard & FiveGActivatedCard) ===
    const city = (row.imp_ttp || 'Unknown').trim()
    const cityData = byCity.get(city) || { total: 0, ready: 0, activated: 0 }
    cityData.total++
    if (row.imp_integ_af) cityData.ready++
    if (row.rfs_af) cityData.activated++
    byCity.set(city, cityData)
    
    // === Nano Cluster aggregation ===
    const cluster = (row.nano_cluster || 'Unknown').trim()
    const clusterData = byNanoCluster.get(cluster) || { total: 0, ready: 0, activated: 0 }
    clusterData.total++
    if (row.imp_integ_af) clusterData.ready++
    if (row.rfs_af) clusterData.activated++
    byNanoCluster.set(cluster, clusterData)
    
    // === Vendor aggregation (for VendorLeaderboardCard) ===
    const vendor = row.vendor_name || 'Unknown'
    const vendorData = byVendor.get(vendor) || { total: 0, ready: 0, activated: 0, forecast: 0 }
    vendorData.total++
    if (row.imp_integ_af) vendorData.ready++
    if (row.rfs_af) vendorData.activated++
    if (row.rfs_ff) vendorData.forecast++
    byVendor.set(vendor, vendorData)
    
    // === Progress curve aggregation ===
    if (row.rfs_bf || row.mocn_activation_forecast) {
      totalBaseline++
      const baselineDate = row.mocn_activation_forecast || row.rfs_bf
      if (baselineDate) {
        const month = baselineDate.substring(0, 7) // YYYY-MM
        const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
        monthData.baseline++
        byMonth.set(month, monthData)
      }
    }
    if (row.rfs_ff) {
      totalForecast++
      const month = row.rfs_ff.substring(0, 7)
      const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
      monthData.forecast++
      byMonth.set(month, monthData)
      
      // Daily runrate - forecast
      try {
        const dateKey = row.rfs_ff.substring(0, 10) // YYYY-MM-DD
        if (dateSet.has(dateKey)) {
          forecastByDate.set(dateKey, (forecastByDate.get(dateKey) || 0) + 1)
        }
      } catch { /* skip invalid dates */ }
    }
    if (row.rfs_af) {
      totalActual++
      const month = row.rfs_af.substring(0, 7)
      const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
      monthData.actual++
      byMonth.set(month, monthData)
      
      // Daily runrate - actual
      try {
        const dateKey = row.rfs_af.substring(0, 10) // YYYY-MM-DD
        if (dateSet.has(dateKey)) {
          actualByDate.set(dateKey, (actualByDate.get(dateKey) || 0) + 1)
        }
      } catch { /* skip invalid dates */ }
    }
    
    // === Issue category aggregation ===
    if (row.issue_category) {
      const category = row.issue_category.trim()
      const categoryLower = category.toLowerCase()
      // Skip excluded categories
      if (category && !EXCLUDED_ISSUES.some(ex => categoryLower.includes(ex))) {
        issueCount.set(category, (issueCount.get(category) || 0) + 1)
        totalIssueCount++
      }
    }
  }
  
  // Build daily runrate array
  const dailyRunrate: DailyRunrateItem[] = last7Days.map(({ dateKey, formatted }) => ({
    date: formatted,
    forecast: forecastByDate.get(dateKey) || 0,
    actual: actualByDate.get(dateKey) || 0
  }))
  
  // Build top 5 issues
  const sortedIssues = Array.from(issueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count], index) => ({
      category,
      count,
      color: ISSUE_COLORS[index % ISSUE_COLORS.length]
    }))
  
  const top5Count = sortedIssues.reduce((sum, item) => sum + item.count, 0)
  
  return {
    byCity,
    byNanoCluster,
    byVendor,
    progressCurve: {
      totalBaseline,
      totalForecast,
      totalActual,
      byMonth
    },
    dailyRunrate,
    topIssues: {
      issues: sortedIssues,
      top5Count,
      totalCount: totalIssueCount
    }
  }
}

// Calculate stats from filtered data - runs on client side
function calculateStatsFromFilteredData(data: Hermes5GSiteData[]): Hermes5GDataStats {
  if (!data || data.length === 0) return EMPTY_STATS
  
  const uniqueClusters = new Set<string>()
  let caf = 0, mos = 0, install = 0, readiness = 0, activated = 0
  let rfc = 0, hotnews = 0, endorse = 0, pac = 0, patp = 0
  
  // Single pass through data for all stats
  for (const row of data) {
    if (row.caf_approved) caf++
    if (row.mos_af) mos++
    if (row.ic_000040_af) install++
    if (row.imp_integ_af) readiness++
    if (row.rfs_af) activated++
    if (row.rfc_approved) rfc++
    if (row.hotnews_af) hotnews++
    if (row.endorse_af) endorse++
    if (row.pac_accepted_af) pac++
    if (row.patp_accepted_af) patp++
    if (row.nano_cluster) uniqueClusters.add(row.nano_cluster)
  }
  
  return {
    totalSites: data.length,
    caf,
    mos,
    install,
    readiness,
    activated,
    rfc,
    hotnews,
    endorse,
    pac,
    patp,
    nanoClusters: uniqueClusters.size
  }
}

export function useHermes5GDataOptimized(options: UseHermes5GDataOptions = {}): UseHermes5GDataReturn {
  const { vendorNames = [], programReports = [], impTtps = [], nanoClusters = [], ranScores = [], years = [], regions = [], search = '' } = options

  // OPTIMIZATION: Always fetch ALL data (no filter) and filter client-side
  // This makes filter changes instant instead of waiting 15-20s for API
  const cacheKey = 'hermes-site-data-all' // Fixed key - always fetch all data
  
  // Track if this is initial load vs filter change
  const hasLoadedOnceRef = useRef(false)

  // Fetch ALL data (no filters) - only once
  const fetchFn = useCallback(async () => {
    // Always fetch without filters - we'll filter client-side
    const url = `/api/hermes-5g/site-data?mode=minimal`
    console.log('[useHermes5GDataOptimized] Fetching ALL Hermes data (no filters)...')
    
    const response = await fetchWithRetry(url, {}, 3)
    const result = await response.json()

    if (result.status === 'success') {
      console.log('[useHermes5GDataOptimized] Fetched ALL data:', result.count, 'records')
      hasLoadedOnceRef.current = true
      const returnData = {
        data: result.data || [],
        stats: result.stats || EMPTY_STATS
      }
      return returnData
    } else {
      throw new Error(result.message || 'Failed to fetch Hermes data')
    }
  }, []) // No dependencies - always fetch all data

  // Use useApiCache untuk base data (tanpa filter)
  const { data: baseData, loading: baseLoading, error, refetch: cacheRefetch } = useApiCache<{ data: Hermes5GSiteData[], stats: Hermes5GDataStats }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - longer since we're caching all data
      cacheTime: 15 * 60 * 1000, // 15 minutes
      refetchOnMount: false, // Don't refetch on every mount
      validateFn: (data) => {
        const typedData = data as { data?: Hermes5GSiteData[], stats?: Hermes5GDataStats }
        if (!data || !typedData.data || !typedData.stats) {
          return false
        }
        return Array.isArray(typedData.data) && typeof typedData.stats === 'object'
      }
    }
  )

  // CLIENT-SIDE FILTERING + AGGREGATION - All done in single pass!
  const { filteredData, filteredStats, aggregated } = useMemo(() => {
    if (!baseData?.data || baseData.data.length === 0) {
      return { filteredData: [], filteredStats: EMPTY_STATS, aggregated: null }
    }
    
    const hasFilters = vendorNames.length > 0 || programReports.length > 0 || 
                       impTtps.length > 0 || nanoClusters.length > 0 || 
                       ranScores.length > 0 || years.length > 0 || regions.length > 0 || search.length > 0
    
    // If no filters, use base data and calculate aggregation
    const dataToUse = hasFilters 
      ? filterDataClientSide(baseData.data, vendorNames, programReports, impTtps, nanoClusters, ranScores, years, regions, search)
      : baseData.data
    
    // Calculate stats (single pass)
    const stats = hasFilters 
      ? calculateStatsFromFilteredData(dataToUse) 
      : baseData.stats
    
    // Pre-aggregate data for all chart components (single pass)
    // This prevents each component from iterating 40k+ rows
    const agg = aggregateDataSinglePass(dataToUse)
    
      return { 
        filteredData: dataToUse, 
        filteredStats: stats,
        aggregated: agg
      }
  }, [baseData, vendorNames, programReports, impTtps, nanoClusters, ranScores, years, regions, search])

  // Refetch function
  const refetch = useCallback(async () => {
    await cacheRefetch()
  }, [cacheRefetch])

  // Only show loading on initial load, not during filter changes
  const loading = baseLoading && !hasLoadedOnceRef.current

  return {
    data: filteredData,
    stats: filteredStats,
    aggregated,
    loading,
    error: error,
    refetch
  }
}

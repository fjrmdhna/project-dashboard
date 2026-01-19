"use client"

import { useMemo, useCallback, useRef } from 'react'
import type { Row as MatrixRow } from '@/components/cards/MatrixStatsCard'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface AopSiteData extends MatrixRow {
  rfc_approved?: string | null
  pac_accepted_af?: string | null
  region_circle?: string | null
  site_category?: string | null
  rfs_bf?: string | null
  rfs_ff?: string | null
  year?: string | null
}

export interface AopDataStats {
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
  nanoClusters: number
}

// Pre-aggregated data for charts (prevents 41k iterations in each component)
export interface AopAggregatedData {
  // For FiveGReadinessCard & FiveGActivatedCard
  byCircle: Map<string, { total: number; ready: number; activated: number; rfi: number }>
  // For VendorLeaderboardCard
  byVendor: Map<string, { total: number; ready: number; activated: number; forecast: number }>
  // For ProgressCurveLineChart
  progressCurve: {
    totalBaseline: number
    totalForecast: number
    totalActual: number
    byMonth: Map<string, { baseline: number; forecast: number; actual: number }>
  }
  // For GapStatusCard
  gaps: {
    sowToRfi: number
    rfiToCrfi: number
    crfiToOa: number
  }
}

export interface UseAopDataReturn {
  data: AopSiteData[]
  stats: AopDataStats
  aggregated: AopAggregatedData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface UseAopDataOptions {
  vendorNames?: string[]
  programReports?: string[]
  circles?: string[]
  siteCategories?: string[]
  years?: string[]
  search?: string
  autoFetch?: boolean
}

// Default empty stats
const EMPTY_STATS: AopDataStats = {
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
  nanoClusters: 0
}

// Client-side filter function - much faster than API call
function filterDataClientSide(
  data: AopSiteData[],
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  years: string[],
  search: string
): AopSiteData[] {
  if (!data || data.length === 0) return []
  
  // If no filters, return all data
  const hasFilters = vendorNames.length > 0 || programReports.length > 0 || 
                     circles.length > 0 || siteCategories.length > 0 || 
                     years.length > 0 || search.length > 0
  
  if (!hasFilters) return data
  
  const searchLower = search.toLowerCase()
  
  return data.filter(row => {
    // Vendor filter
    if (vendorNames.length > 0 && !vendorNames.includes(row.vendor_name || '')) {
      return false
    }
    
    // Program filter
    if (programReports.length > 0 && !programReports.includes(row.program_report || '')) {
      return false
    }
    
    // Circle filter (case-insensitive)
    if (circles.length > 0) {
      const rowCircle = (row.region_circle || '').toLowerCase()
      const matchesCircle = circles.some(c => rowCircle.includes(c.toLowerCase()))
      if (!matchesCircle) return false
    }
    
    // Site category filter (case-insensitive)
    if (siteCategories.length > 0) {
      const rowCategory = (row.site_category || '').toLowerCase()
      const matchesCategory = siteCategories.some(sc => rowCategory.includes(sc.toLowerCase()))
      if (!matchesCategory) return false
    }
    
    // Year filter
    if (years.length > 0 && !years.includes(row.year || '')) {
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
      if (!matchesSearch) return false
    }
    
    return true
  })
}

// OPTIMIZATION: Single-pass aggregation for ALL chart components
// This prevents multiple O(n) iterations in each component
function aggregateDataSinglePass(data: AopSiteData[]): AopAggregatedData {
  const byCircle = new Map<string, { total: number; ready: number; activated: number; rfi: number }>()
  const byVendor = new Map<string, { total: number; ready: number; activated: number; forecast: number }>()
  const byMonth = new Map<string, { baseline: number; forecast: number; actual: number }>()
  
  let totalBaseline = 0, totalForecast = 0, totalActual = 0
  let sowToRfi = 0, rfiToCrfi = 0, crfiToOa = 0
  
  // Single pass through all data
  for (const row of data) {
    // === Circle aggregation (for FiveGReadinessCard & FiveGActivatedCard) ===
    const circle = (row.region_circle || 'Unknown').trim().toUpperCase()
    const circleData = byCircle.get(circle) || { total: 0, ready: 0, activated: 0, rfi: 0 }
    circleData.total++
    if (row.imp_integ_af) circleData.ready++
    if (row.rfs_af) circleData.activated++
    if (row.ic_000010_af) circleData.rfi++
    byCircle.set(circle, circleData)
    
    // === Vendor aggregation (for VendorLeaderboardCard) ===
    const vendor = row.vendor_name || 'Unknown'
    const vendorData = byVendor.get(vendor) || { total: 0, ready: 0, activated: 0, forecast: 0 }
    vendorData.total++
    if (row.imp_integ_af) vendorData.ready++
    if (row.rfs_af) vendorData.activated++
    if (row.rfs_ff) vendorData.forecast++
    byVendor.set(vendor, vendorData)
    
    // === Progress curve aggregation ===
    if (row.rfs_bf) {
      totalBaseline++
      const month = row.rfs_bf.substring(0, 7) // YYYY-MM
      const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
      monthData.baseline++
      byMonth.set(month, monthData)
    }
    if (row.rfs_ff) {
      totalForecast++
      const month = row.rfs_ff.substring(0, 7)
      const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
      monthData.forecast++
      byMonth.set(month, monthData)
    }
    if (row.rfs_af) {
      totalActual++
      const month = row.rfs_af.substring(0, 7)
      const monthData = byMonth.get(month) || { baseline: 0, forecast: 0, actual: 0 }
      monthData.actual++
      byMonth.set(month, monthData)
    }
    
    // === Gap status aggregation ===
    const hasSystemKey = !!(row.system_key && String(row.system_key).trim() !== '')
    const hasInstall = !!(row.ic_000040_af && String(row.ic_000040_af).trim() !== '')
    const hasCaf = !!(row.caf_approved && String(row.caf_approved).trim() !== '')
    const hasActivated = !!(row.rfs_af && String(row.rfs_af).trim() !== '')
    
    if (hasSystemKey && !hasInstall) sowToRfi++
    if (hasInstall && !hasCaf) rfiToCrfi++
    if (hasCaf && !hasActivated) crfiToOa++
  }
  
  return {
    byCircle,
    byVendor,
    progressCurve: {
      totalBaseline,
      totalForecast,
      totalActual,
      byMonth
    },
    gaps: {
      sowToRfi,
      rfiToCrfi,
      crfiToOa
    }
  }
}

// Calculate stats from filtered data - runs on client side
function calculateStatsFromFilteredData(data: AopSiteData[]): AopDataStats {
  if (!data || data.length === 0) return EMPTY_STATS
  
  const uniqueClusters = new Set<string>()
  let caf = 0, mos = 0, install = 0, readiness = 0, activated = 0
  let rfc = 0, hotnews = 0, endorse = 0, pac = 0
  
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
    if (row.region_circle) uniqueClusters.add(row.region_circle)
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
    nanoClusters: uniqueClusters.size
  }
}

export function useAopData(options: UseAopDataOptions = {}): UseAopDataReturn {
  const { vendorNames = [], programReports = [], circles = [], siteCategories = [], years = [], search = '' } = options

  // OPTIMIZATION: Always fetch ALL data (no filter) and filter client-side
  // This makes filter changes instant instead of waiting 15-20s for API
  const cacheKey = 'aop-site-data-all' // Fixed key - always fetch all data
  
  // Track if this is initial load vs filter change
  const hasLoadedOnceRef = useRef(false)

  // Fetch ALL data (no filters) - only once
  const fetchFn = useCallback(async () => {
    // Always fetch without filters - we'll filter client-side
    const url = `/api/aop/site-data`
    console.log('[useAopData] Fetching ALL AOP data (no filters)...')
    
    const response = await fetchWithRetry(url, {}, 3)
    const result = await response.json()

    if (result.status === 'success') {
      console.log('[useAopData] Fetched ALL data:', result.count, 'records')
      hasLoadedOnceRef.current = true
      return {
        data: result.data || [],
        stats: result.stats || EMPTY_STATS
      }
    } else {
      throw new Error(result.message || 'Failed to fetch AOP data')
    }
  }, []) // No dependencies - always fetch all data

  // Use useApiCache untuk base data (tanpa filter)
  const { data: baseData, loading: baseLoading, error, refetch: cacheRefetch } = useApiCache<{ data: AopSiteData[], stats: AopDataStats }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - longer since we're caching all data
      cacheTime: 15 * 60 * 1000, // 15 minutes
      refetchOnMount: false, // Don't refetch on every mount
      validateFn: (data) => {
        const typedData = data as { data?: AopSiteData[], stats?: AopDataStats }
        if (!data || !typedData.data || !typedData.stats) {
          return false
        }
        return Array.isArray(typedData.data) && typeof typedData.stats === 'object'
      }
    }
  )

  // CLIENT-SIDE FILTERING + AGGREGATION - All done in single pass!
  const { filteredData, filteredStats, aggregated } = useMemo(() => {
    // #region agent log
    const startTotal = performance.now();
    // #endregion
    if (!baseData?.data || baseData.data.length === 0) {
      return { filteredData: [], filteredStats: EMPTY_STATS, aggregated: null }
    }
    
    const hasFilters = vendorNames.length > 0 || programReports.length > 0 || 
                       circles.length > 0 || siteCategories.length > 0 || 
                       years.length > 0 || search.length > 0
    
    // #region agent log
    const startFilter = performance.now();
    // #endregion
    // If no filters, use base data and calculate aggregation
    const dataToUse = hasFilters 
      ? filterDataClientSide(baseData.data, vendorNames, programReports, circles, siteCategories, years, search)
      : baseData.data
    // #region agent log
    const filterTime = performance.now() - startFilter;
    // #endregion
    
    // #region agent log
    const startStats = performance.now();
    // #endregion
    // Calculate stats (single pass)
    const stats = hasFilters 
      ? calculateStatsFromFilteredData(dataToUse) 
      : baseData.stats
    // #region agent log
    const statsTime = performance.now() - startStats;
    // #endregion
    
    // #region agent log
    const startAgg = performance.now();
    // #endregion
    // Pre-aggregate data for all chart components (single pass)
    // This prevents each component from iterating 41k rows
    const agg = aggregateDataSinglePass(dataToUse)
    // #region agent log
    const aggTime = performance.now() - startAgg;
    const totalTime = performance.now() - startTotal;
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:useMemo',message:'HOOK PROCESSING TIME',data:{baseDataLen:baseData.data.length,filteredLen:dataToUse.length,hasFilters,filterTimeMs:filterTime.toFixed(2),statsTimeMs:statsTime.toFixed(2),aggTimeMs:aggTime.toFixed(2),totalTimeMs:totalTime.toFixed(2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'HOOK'})}).catch(()=>{});
    // #endregion
    
    return { 
      filteredData: dataToUse, 
      filteredStats: stats,
      aggregated: agg
    }
  }, [baseData, vendorNames, programReports, circles, siteCategories, years, search])

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

"use client"

import { useMemo, useCallback, useRef } from 'react'
import type { Row as MatrixRow } from '@/components/cards/MatrixStatsCard'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'
import { format, subDays } from 'date-fns'

// Helper function to normalize site_category for filtering
// Must match the normalization in supabase.ts
function normalizeSiteCategoryForFilter(value: string | null | undefined): string {
  if (!value) return ''
  
  const lowerValue = value.toLowerCase().trim()
  
  // Check for "new" keyword (case-insensitive) -> "new site"
  if (lowerValue.includes('new')) {
    return 'new site'
  }
  
  // Check for "existing" or "upgrade" keyword (case-insensitive) -> "expansion"
  if (lowerValue.includes('existing') || lowerValue.includes('upgrade')) {
    return 'expansion'
  }
  
  // Return lowercase original value for others
  return lowerValue
}

// Helper function to normalize priority_congest_urgent for filtering
// Must match the normalization in supabase.ts
function normalizePriorityCongestUrgentForFilter(value: string | null | undefined): string {
  if (!value) return ''
  
  // Normalize multiple spaces to single space before checking
  const normalizedSpaces = value.replace(/\s+/g, ' ').trim()
  const lowerValue = normalizedSpaces.toLowerCase()
  
  // Check for "prio lebaran" keyword (case-insensitive, handles multiple spaces) -> "prio lebaran"
  if (lowerValue.includes('prio lebaran')) {
    return 'prio lebaran'
  }
  
  // Extract P1, P2, P3, or P4 (case-insensitive, can be standalone or part of text)
  // Pattern: matches "p1", "p2", "p3", "p4" (with word boundaries)
  const p1Match = lowerValue.match(/\bp1\b/i)
  const p2Match = lowerValue.match(/\bp2\b/i)
  const p3Match = lowerValue.match(/\bp3\b/i)
  const p4Match = lowerValue.match(/\bp4\b/i)
  
  if (p1Match) {
    return 'p1'
  }
  if (p2Match) {
    return 'p2'
  }
  if (p3Match) {
    return 'p3'
  }
  if (p4Match) {
    return 'p4'
  }
  
  // Return lowercase normalized value for others
  return lowerValue
}

// Helper function to normalize ran_score for filtering
// Must match the normalization in supabase.ts
function normalizeRanScoreForFilter(value: string | null | undefined): string {
  if (!value) return ''
  
  // Normalize multiple spaces to single space before checking
  const normalizedSpaces = value.replace(/\s+/g, ' ').trim()
  const lowerValue = normalizedSpaces.toLowerCase()
  
  // Check for "co" and "new site" (case-insensitive, handles multiple spaces and dashes)
  // Pattern: "co" as a word (not substring like in "scope") followed by optional spaces/dashes and "new site"
  // Use word boundary to ensure "co" is a separate word, not part of another word
  const hasCoAsWord = /\bco\b/i.test(normalizedSpaces)
  if (hasCoAsWord && lowerValue.includes('new site')) {
    return 'co new site'
  }
  
  // Check for "co" and "expansion" (case-insensitive, handles multiple spaces and dashes)
  // All variations (with or without dash) -> "co expansion" (unified, no dash)
  // This takes priority over expansion + year normalization
  // Use word boundary to ensure "co" is a separate word, not part of another word
  if (hasCoAsWord && lowerValue.includes('expansion')) {
    return 'co expansion'
  }
  
  // Check for "new site" and "2026" (case-insensitive, without "co" as a word)
  // Pattern: "new site" followed by optional spaces and "2026"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('new site') && lowerValue.includes('2026')) {
    return 'new site 2026'
  }
  
  // Check for "new site" and "2025" (case-insensitive, without "co" as a word)
  // Pattern: "new site" followed by optional spaces and "2025"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('new site') && lowerValue.includes('2025')) {
    return 'new site 2025'
  }
  
  // Check for "expansion" and "2026" (case-insensitive, without "co" as a word)
  // Pattern: "expansion" followed by optional spaces and "2026"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('expansion') && lowerValue.includes('2026')) {
    return 'expansion 2026'
  }
  
  // Check for "expansion" and "2025" (case-insensitive, without "co" as a word)
  // Pattern: "expansion" followed by optional spaces and "2025"
  // Use word boundary to ensure "co" is not present as a separate word
  if (!hasCoAsWord && lowerValue.includes('expansion') && lowerValue.includes('2025')) {
    return 'expansion 2025'
  }
  
  // Return lowercase normalized value for others
  return lowerValue
}

export interface AopSiteData extends MatrixRow {
  site_id?: string | null
  site_name?: string | null
  rfc_approved?: string | null
  fatp_accepted_af?: string | null  // FATP - Matrix milestone
  patp_accepted_af?: string | null  // PATP - Matrix milestone
  pac_accepted_af?: string | null
  region_circle?: string | null
  site_category?: string | null
  ran_score?: string | null
  priority_congest_urgent?: string | null
  pic_indosat?: string | null  // Trial GB Factory filter; blank = "Other"
  mocn_activation_forecast?: string | null  // Baseline for ProgressCurve
  rfs_bf?: string | null                    // Legacy baseline
  rfs_ff?: string | null
  year?: string | null
  issue_category?: string | null
}

export interface AopDataStats {
  totalSites: number
  caf: number
  mos: number
  install: number
  readiness: number
  activated: number
  rfc: number
  fatp: number
  patp: number
  hotnews: number
  endorse: number
  pac: number
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

// Pre-aggregated data for charts (prevents 41k iterations in each component)
// ProgressCurveLineChart uses rows + mocn_activation_forecast directly; no progressCurve here.
export interface AopAggregatedData {
  // For FiveGReadinessCard & FiveGActivatedCard
  byCircle: Map<string, { total: number; ready: number; activated: number; rfi: number }>
  // For VendorLeaderboardCard
  byVendor: Map<string, { total: number; ready: number; activated: number; forecast: number }>
  // For GapStatusCard
  gaps: {
    sowToRfi: number
    rfiToCrfi: number
    crfiToOa: number
  }
  // For DailyRunrateCard (client-side calculated)
  dailyRunrate: DailyRunrateItem[]
  // For TopIssueCard (client-side calculated)
  topIssues: {
    issues: TopIssueItem[]
    top5Count: number
    totalCount: number
  }
  // Stats computed in same pass as aggregation (avoids extra calculateStatsFromFilteredData pass)
  stats: AopDataStats
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
  ranScores?: string[]
  years?: string[]
  priorityCongestUrgent?: string[]
  trialGbFactory?: string[]  // pic_indosat; blank in data = "Other"
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
  fatp: 0,
  patp: 0,
  hotnews: 0,
  endorse: 0,
  pac: 0,
  nanoClusters: 0
}

// Normalize pic_indosat for filter: blank → "Other"
function normalizePicIndosatForFilter(value: string | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === '') return 'Other'
  return String(value).trim()
}

// Client-side filter function - much faster than API call
function filterDataClientSide(
  data: AopSiteData[],
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  ranScores: string[],
  years: string[],
  priorityCongestUrgent: string[],
  trialGbFactory: string[],
  search: string
): AopSiteData[] {
  if (!data || data.length === 0) return []

  const hasFilters = vendorNames.length > 0 || programReports.length > 0 ||
                     circles.length > 0 || siteCategories.length > 0 ||
                     ranScores.length > 0 || years.length > 0 ||
                     priorityCongestUrgent.length > 0 || trialGbFactory.length > 0 || search.length > 0

  if (!hasFilters) return data

  const searchLower = search.toLowerCase()

  const filtered = data.filter((row) => {
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
    
    // Site category filter (normalized matching)
    // Filter values are normalized (e.g., "New Site", "Expansion")
    // Row values need to be normalized before comparison
    if (siteCategories.length > 0) {
      const normalizedRowCategory = normalizeSiteCategoryForFilter(row.site_category)
      const matchesCategory = siteCategories.some(sc => normalizedRowCategory === sc.toLowerCase())
      if (!matchesCategory) return false
    }
    
    // RAN Score filter (normalized matching)
    // Filter values are normalized (e.g., "Co - Expansion")
    // Row values need to be normalized before comparison
    if (ranScores.length > 0) {
      const normalizedRowRanScore = normalizeRanScoreForFilter(row.ran_score)
      const matchesRanScore = ranScores.some(rs => normalizedRowRanScore === normalizeRanScoreForFilter(rs))
      if (!matchesRanScore) return false
    }
    
    // Year filter
    if (years.length > 0 && !years.includes(row.year || '')) {
      return false
    }
    
    // Priority Congest Urgent filter (normalized matching)
    if (priorityCongestUrgent.length > 0) {
      const normalizedRowPriority = normalizePriorityCongestUrgentForFilter(row.priority_congest_urgent)
      const matchesPriority = priorityCongestUrgent.some(p => normalizedRowPriority === normalizePriorityCongestUrgentForFilter(p))
      if (!matchesPriority) return false
    }

    // Trial GB Factory (pic_indosat): blank = "Other"
    if (trialGbFactory.length > 0) {
      const rowValue = normalizePicIndosatForFilter(row.pic_indosat)
      if (!trialGbFactory.includes(rowValue)) return false
    }

    // Search filter (must match API: system_key, site_id, site_name, vendor_name; program_report for consistency)
    if (searchLower) {
      const searchFields = [
        row.system_key,
        row.site_id,
        row.site_name,
        row.vendor_name,
        row.program_report
      ].filter(Boolean).map(s => (s || '').toLowerCase())
      
      const matchesSearch = searchFields.some(field => field.includes(searchLower))
      if (!matchesSearch) return false
    }
    
    return true
  })
  
  return filtered
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

// OPTIMIZATION: Single-pass aggregation for ALL chart components + stats
// ProgressCurveLineChart uses rows + mocn_activation_forecast directly, not aggregated here.
function aggregateDataSinglePass(data: AopSiteData[]): AopAggregatedData {
  const byCircle = new Map<string, { total: number; ready: number; activated: number; rfi: number }>()
  const byVendor = new Map<string, { total: number; ready: number; activated: number; forecast: number }>()
  let sowToRfi = 0, rfiToCrfi = 0, crfiToOa = 0
  
  // Stats (merged from calculateStatsFromFilteredData to avoid extra pass)
  const uniqueClusters = new Set<string>()
  let caf = 0, mos = 0, install = 0, readiness = 0, activated = 0
  let rfc = 0, fatp = 0, patp = 0, hotnews = 0, endorse = 0, pac = 0
  
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
    
    // === Stats (same as calculateStatsFromFilteredData, avoids 2nd pass) ===
    if (row.caf_approved) caf++
    if (row.mos_af) mos++
    if (row.ic_000040_af) install++
    if (row.imp_integ_af) readiness++
    if (row.rfs_af) activated++
    if (row.rfc_approved) rfc++
    // FATP: Check if fatp_accepted_af exists and is not null/empty (matches API fallback logic)
    if (row.fatp_accepted_af && String(row.fatp_accepted_af).trim() !== '') fatp++
    // PATP: Check if patp_accepted_af exists and is not null/empty (matches API fallback logic)
    if (row.patp_accepted_af && String(row.patp_accepted_af).trim() !== '') patp++
    if (row.hotnews_af) hotnews++
    if (row.endorse_af) endorse++
    if (row.pac_accepted_af) pac++
    if (row.region_circle) uniqueClusters.add(row.region_circle)
    
    // === Daily runrate (forecast from rfs_ff, actual from rfs_af) ===
    if (row.rfs_ff) {
      try {
        const dateKey = row.rfs_ff.substring(0, 10)
        if (dateSet.has(dateKey)) forecastByDate.set(dateKey, (forecastByDate.get(dateKey) || 0) + 1)
      } catch { /* skip */ }
    }
    if (row.rfs_af) {
      try {
        const dateKey = row.rfs_af.substring(0, 10)
        if (dateSet.has(dateKey)) actualByDate.set(dateKey, (actualByDate.get(dateKey) || 0) + 1)
      } catch { /* skip */ }
    }
    
    // === Gap status aggregation ===
    const hasSystemKey = !!(row.system_key && String(row.system_key).trim() !== '')
    const hasInstall = !!(row.ic_000040_af && String(row.ic_000040_af).trim() !== '')
    const hasCaf = !!(row.caf_approved && String(row.caf_approved).trim() !== '')
    const hasActivated = !!(row.rfs_af && String(row.rfs_af).trim() !== '')
    if (hasSystemKey && !hasInstall) sowToRfi++
    if (hasInstall && !hasCaf) rfiToCrfi++
    if (hasCaf && !hasActivated) crfiToOa++
    
    // === Issue category aggregation ===
    if (row.issue_category) {
      const category = row.issue_category.trim()
      const categoryLower = category.toLowerCase()
      if (category && !EXCLUDED_ISSUES.some(ex => categoryLower.includes(ex))) {
        issueCount.set(category, (issueCount.get(category) || 0) + 1)
        totalIssueCount++
      }
    }
  }
  
  const dailyRunrate: DailyRunrateItem[] = last7Days.map(({ dateKey, formatted }) => ({
    date: formatted,
    forecast: forecastByDate.get(dateKey) || 0,
    actual: actualByDate.get(dateKey) || 0
  }))
  
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
    byCircle,
    byVendor,
    gaps: { sowToRfi, rfiToCrfi, crfiToOa },
    dailyRunrate,
    topIssues: { issues: sortedIssues, top5Count, totalCount: totalIssueCount },
    stats: {
      totalSites: data.length,
      caf,
      mos,
      install,
      readiness,
      activated,
      rfc,
      fatp,
      patp,
      hotnews,
      endorse,
      pac,
      nanoClusters: uniqueClusters.size
    }
  }
}

export function useAopData(options: UseAopDataOptions = {}): UseAopDataReturn {
  const { vendorNames = [], programReports = [], circles = [], siteCategories = [], ranScores = [], years = [], priorityCongestUrgent = [], trialGbFactory = [], search = '' } = options

  // OPTIMIZATION: Always fetch ALL data (no filter) and filter client-side
  // This makes filter changes instant instead of waiting 15-20s for API
  const cacheKey = 'aop-site-data-all' // Fixed key - always fetch all data
  
  // Track if this is initial load vs filter change
  const hasLoadedOnceRef = useRef(false)

  // Fetch ALL data (no filters) - only once
  const fetchFn = useCallback(async () => {
    const url = `/api/aop/site-data`
    const response = await fetchWithRetry(url, {}, 3)
    const result = await response.json()

    if (result.status === 'success') {
      hasLoadedOnceRef.current = true
      return {
        data: result.data || [],
        stats: result.stats || EMPTY_STATS
      }
    }
    throw new Error(result.message || 'Failed to fetch AOP data')
  }, [])

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
    if (!baseData?.data || baseData.data.length === 0) {
      return { filteredData: [], filteredStats: EMPTY_STATS, aggregated: null }
    }
    
    const hasFilters =
      vendorNames.length > 0 ||
      programReports.length > 0 ||
      circles.length > 0 ||
      siteCategories.length > 0 ||
      ranScores.length > 0 ||
      years.length > 0 ||
      priorityCongestUrgent.length > 0 ||
      trialGbFactory.length > 0 ||
      search.length > 0

    const dataToUse = hasFilters
      ? filterDataClientSide(
          baseData.data,
          vendorNames,
          programReports,
          circles,
          siteCategories,
          ranScores,
          years,
          priorityCongestUrgent,
          trialGbFactory,
          search
        )
      : baseData.data

    // Safety check: ensure dataToUse is always an array
    if (!dataToUse || !Array.isArray(dataToUse)) {
      return { filteredData: [], filteredStats: EMPTY_STATS, aggregated: null }
    }

    const agg = aggregateDataSinglePass(dataToUse)
    const stats = hasFilters ? agg.stats : baseData.stats

    return {
      filteredData: dataToUse,
      filteredStats: stats,
      aggregated: agg
    }
  }, [baseData, vendorNames, programReports, circles, siteCategories, ranScores, years, priorityCongestUrgent, trialGbFactory, search])

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

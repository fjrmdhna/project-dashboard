"use client"

import { useMemo, useCallback } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { buildFilterParams } from '@/lib/filters'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'
import { Row } from '@/components/cards/MatrixStatsCard'
import { TopIssue } from './useTopIssueData'
import { DailyRunrateItem } from './useDailyRunrateData'
import { VendorScore } from './useVendorLeaderboard'

interface Hermes5GData {
  siteData: {
    rows: Row[]
    count: number
  }
  topIssues: {
    data: TopIssue[]
    topIssuesTotal: number
    totalIssues: number
  }
  dailyRunrate: DailyRunrateItem[]
  vendorLeaderboard: {
    data: VendorScore[]
    totalVendors: number
  }
}

interface UseHermes5GDataOptions {
  filter?: FilterValue
}

interface UseHermes5GDataReturn {
  data: Hermes5GData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useHermes5GData(options: UseHermes5GDataOptions = {}): UseHermes5GDataReturn {
  const filter = options.filter || {
    q: '',
    vendor_name: [],
    program_report: [],
    imp_ttp: [],
    nano_cluster: [],
    status: []
  }

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `hermes-5g-all-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk parallel fetching
  const fetchFn = useCallback(async (): Promise<Hermes5GData> => {
    const params = buildFilterParams(filter)
    const baseUrl = `/api/hermes-5g`
    
    // Parallel fetching semua endpoints dengan retry logic
    const [siteDataRes, topIssuesRes, dailyRunrateRes, vendorLeaderboardRes] = await Promise.all([
      fetchWithRetry(`${baseUrl}/site-data?${params.toString()}`, {}, 3),
      fetchWithRetry(`${baseUrl}/top-5-issue?${params.toString()}`, {}, 3),
      fetchWithRetry(`${baseUrl}/daily-runrate?${params.toString()}`, {}, 3),
      fetchWithRetry(`${baseUrl}/vendor-leaderboard?${params.toString()}`, {}, 3)
    ])

    // Responses are already checked by fetchWithRetry (only returns if ok)

    // Parse all responses
    const [siteDataJson, topIssuesJson, dailyRunrateJson, vendorLeaderboardJson] = await Promise.all([
      siteDataRes.json(),
      topIssuesRes.json(),
      dailyRunrateRes.json(),
      vendorLeaderboardRes.json()
    ])

    // Validate all responses
    if (siteDataJson.status !== 'success') {
      throw new Error(siteDataJson.message || 'Failed to fetch site data')
    }
    if (topIssuesJson.status !== 'success') {
      throw new Error(topIssuesJson.message || 'Failed to fetch top issues')
    }
    if (dailyRunrateJson.status !== 'success') {
      throw new Error(dailyRunrateJson.message || 'Failed to fetch daily runrate')
    }
    if (vendorLeaderboardJson.status !== 'success') {
      throw new Error(vendorLeaderboardJson.message || 'Failed to fetch vendor leaderboard')
    }

    // Return combined data
    return {
      siteData: {
        rows: siteDataJson.data || [],
        count: siteDataJson.count || 0
      },
      topIssues: {
        data: topIssuesJson.data || [],
        topIssuesTotal: topIssuesJson.top5Count || 0,
        totalIssues: topIssuesJson.filteredTotalCount || 0
      },
      dailyRunrate: dailyRunrateJson.data || [],
      vendorLeaderboard: {
        data: vendorLeaderboardJson.data || [],
        totalVendors: vendorLeaderboardJson.totalVendors || 0
      }
    }
  }, [filter])

  // Use useApiCache dengan validasi
  const { data, loading, error, refetch } = useApiCache<Hermes5GData>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Hanya cache jika semua data sukses dan tidak kosong
        return (
          data.siteData.rows.length > 0 &&
          data.siteData.count > 0 &&
          Array.isArray(data.topIssues.data) &&
          data.topIssues.data.length > 0 &&
          Array.isArray(data.dailyRunrate) &&
          data.dailyRunrate.length > 0 &&
          Array.isArray(data.vendorLeaderboard.data) &&
          data.vendorLeaderboard.data.length > 0
        )
      }
    }
  )

  return {
    data,
    loading,
    error,
    refetch
  }
}


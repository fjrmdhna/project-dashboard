"use client"

import { useMemo, useCallback } from 'react'
import { useApiCache } from '@/hooks/useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'
import type { FilterValue } from '@/components/filters/FilterBar'
import type { TopIssue } from '@/hooks/useTopIssueData'

interface UseTLPTopIssueDataOptions {
  filter?: FilterValue
}

interface UseTLPTopIssueDataReturn {
  data: TopIssue[]
  loading: boolean
  error: Error | null
  topIssuesTotal: number
  totalIssues: number
  refreshData: () => Promise<void>
}

export function useTLPTopIssueData(options: UseTLPTopIssueDataOptions = {}): UseTLPTopIssueDataReturn {
  const { filter } = options
  
  // Build cache key from filter
  const cacheKey = useMemo(() => {
    return `tlp-top-issue-${JSON.stringify(filter || {})}`
  }, [filter])
  
  // Build URL with filters
  const buildUrl = useCallback((filter: FilterValue | undefined) => {
    const params = new URLSearchParams()
    if (filter?.q) params.append('q', filter.q)
    if (filter?.vendor_name) {
      filter.vendor_name.forEach(vendor => params.append('vendor_code', vendor))
    }
    if (filter?.program_report) {
      filter.program_report.forEach(program => params.append('program_name', program))
    }
    if (filter?.imp_ttp) {
      filter.imp_ttp.forEach(region => params.append('region', region))
    }
    const qs = params.toString()
    return qs ? `/api/tlp/top-5-issue?${qs}` : '/api/tlp/top-5-issue'
  }, [])
  
  // Fetch function
  const fetchFn = useCallback(async () => {
    const url = buildUrl(filter)
    const response = await fetchWithRetry(url, {}, 3)
    
    const result = await response.json()
    
    if (result.status === 'success') {
      return {
        data: result.data || [],
        topIssuesTotal: result.top5Count || 0,
        totalIssues: result.filteredTotalCount || 0
      }
    } else {
      throw new Error(result.message || 'Unknown error')
    }
  }, [filter, buildUrl])
  
  // Use useApiCache
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<{ 
    data: TopIssue[]
    topIssuesTotal: number
    totalIssues: number 
  }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Validasi struktur data - cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        const typedData = data as { data?: TopIssue[], topIssuesTotal?: number, totalIssues?: number }
        if (!data || !typedData.data) {
          return false
        }
        // Validasi bahwa data adalah array
        // Cache data kosong juga (dengan expiry lebih pendek) untuk mencegah refetch berulang
        return Array.isArray(typedData.data)
      }
    }
  )
  
  // Refetch function
  const refreshData = useCallback(async () => {
    await cacheRefetch()
  }, [cacheRefetch])
  
  return {
    data: cachedData?.data || [],
    loading,
    error: error ? new Error(error) : null,
    topIssuesTotal: cachedData?.topIssuesTotal || 0,
    totalIssues: cachedData?.totalIssues || 0,
    refreshData
  }
}


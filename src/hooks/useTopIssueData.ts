"use client"

import { useMemo, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { buildFilterParams } from '@/lib/filters'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface TopIssue {
  category: string
  count: number
  color: string
}

interface UseTopIssueDataOptions {
  filter?: FilterValue
}

interface UseTopIssueDataReturn {
  data: TopIssue[]
  loading: boolean
  error: Error | null
  topIssuesTotal: number
  totalIssues: number
  refreshData: () => Promise<void>
}

export function useTopIssueData(options: UseTopIssueDataOptions = {}): UseTopIssueDataReturn {
  const filter = options.filter || { q: '', vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [], status: [] }

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `top-issue-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    // Build consistent filter params (supports multi-value)
    const params = buildFilterParams(filter)

    const response = await fetchWithRetry(`/api/hermes-5g/top-5-issue?${params.toString()}`, {}, 3)
    
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
  }, [filter])

  // Use useApiCache dengan validasi
  // useApiCache akan otomatis refetch saat cacheKey berubah, tidak perlu useEffect manual
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<{ data: TopIssue[], topIssuesTotal: number, totalIssues: number }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        // Empty data akan di-cache dengan expiry lebih pendek (1 menit)
        return data !== null && data !== undefined && typeof data === 'object' && Array.isArray(data.data)
      }
    }
  )

  // Return data dan functions
  return {
    data: cachedData?.data || [],
    loading,
    error: error ? new Error(error) : null,
    topIssuesTotal: cachedData?.topIssuesTotal || 0,
    totalIssues: cachedData?.totalIssues || 0,
    refreshData: cacheRefetch
  }
} 

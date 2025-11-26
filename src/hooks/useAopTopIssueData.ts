"use client"

import { useMemo, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface TopIssue {
  category: string
  count: number
  color: string
}

interface UseAopTopIssueDataOptions {
  filter?: FilterValue
}

interface UseAopTopIssueDataReturn {
  data: TopIssue[]
  loading: boolean
  error: Error | null
  topIssuesTotal: number
  totalIssues: number
  refreshData: () => Promise<void>
}

export function useAopTopIssueData(options: UseAopTopIssueDataOptions = {}): UseAopTopIssueDataReturn {
  const filter = options.filter || { q: '', vendor_name: [], program_report: [], circle: [], ran_score: [], status: [] }

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `aop-top-issue-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    // Build filter params untuk AOP (menggunakan circle bukan imp_ttp/nano_cluster)
    const params = new URLSearchParams()
    if (filter.q) params.append('q', filter.q)
    filter.vendor_name?.forEach(v => params.append('vendor_name', v))
    filter.program_report?.forEach(p => params.append('program_report', p))
    filter.circle?.forEach(c => params.append('region_circle', c))
    filter.ran_score?.forEach(score => params.append('ran_score', score))

    const response = await fetchWithRetry(`/api/aop/top-5-issue?${params.toString()}`, {}, 3)
    
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
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<{ data: TopIssue[], topIssuesTotal: number, totalIssues: number }>(
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


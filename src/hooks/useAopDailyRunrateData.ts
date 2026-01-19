"use client"

import { useMemo, useCallback } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { format, subDays } from 'date-fns'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface AopDailyRunrateItem {
  date: string
  forecast: number
  actual: number
}

interface UseAopDailyRunrateDataOptions {
  filter?: FilterValue
}

interface UseAopDailyRunrateDataReturn {
  data: AopDailyRunrateItem[]
  loading: boolean
  error: Error | null
  refreshData: () => Promise<void>
}

export function useAopDailyRunrateData(options: UseAopDailyRunrateDataOptions = {}): UseAopDailyRunrateDataReturn {
  const filter = options.filter || { q: '', vendor_name: [], program_report: [], circle: [], status: [] }

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `aop-daily-runrate-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    // Build filter params untuk AOP
    const params = new URLSearchParams()
    if (filter.q) params.append('q', filter.q)
    filter.vendor_name?.forEach(v => params.append('vendor_name', v))
    filter.program_report?.forEach(p => params.append('program_report', p))
    filter.circle?.forEach(c => params.append('region_circle', c))

    const response = await fetchWithRetry(`/api/aop/daily-runrate?${params.toString()}`, {}, 3)
    
    const result = await response.json()
    
    if (result.status === 'success') {
      return result.data || []
    } else {
      throw new Error(result.message || 'Unknown error')
    }
  }, [filter])

  // Use useApiCache dengan validasi
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<AopDailyRunrateItem[]>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Cache semua valid array (termasuk empty) untuk mencegah infinite refetch
        return Array.isArray(data)
      }
    }
  )

  // Generate fallback data jika error (tidak di-cache)
  const fallbackData: AopDailyRunrateItem[] = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(today, 6 - i), 'dd-MMM-yy'),
      forecast: 0,
      actual: 0
    }))
  }, [])

  // Return data dan functions
  return {
    data: cachedData || (error ? fallbackData : []),
    loading,
    error: error ? new Error(error) : null,
    refreshData: cacheRefetch
  }
}


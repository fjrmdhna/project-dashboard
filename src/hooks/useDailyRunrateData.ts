"use client"

import { useMemo, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { format, subDays } from 'date-fns'
import { buildFilterParams } from '@/lib/filters'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface DailyRunrateItem {
  date: string
  readiness: number
  activated: number
}

interface UseDailyRunrateDataOptions {
  filter?: FilterValue
}

interface UseDailyRunrateDataReturn {
  data: DailyRunrateItem[]
  loading: boolean
  error: Error | null
  refreshData: () => Promise<void>
}

export function useDailyRunrateData(options: UseDailyRunrateDataOptions = {}): UseDailyRunrateDataReturn {
  const filter = options.filter || { q: '', vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [], status: [] }

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `daily-runrate-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    // Prepare consistent filter params
    const params = buildFilterParams(filter)

    const response = await fetchWithRetry(`/api/hermes-5g/daily-runrate?${params.toString()}`, {}, 3)
    
    const result = await response.json()
    
    if (result.status === 'success') {
      return result.data || []
    } else {
      throw new Error(result.message || 'Unknown error')
    }
  }, [filter])

  // Use useApiCache dengan validasi
  // useApiCache akan otomatis refetch saat cacheKey berubah, tidak perlu useEffect manual
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<DailyRunrateItem[]>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Cache semua valid array (termasuk empty) untuk mencegah infinite refetch
        // Empty array akan di-cache dengan expiry lebih pendek (1 menit)
        return Array.isArray(data)
      }
    }
  )

  // Generate fallback data jika error (tidak di-cache)
  const fallbackData: DailyRunrateItem[] = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(today, 6 - i), 'dd-MMM-yy'),
      readiness: 0,
      activated: 0
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

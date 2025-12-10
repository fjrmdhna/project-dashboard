"use client"

import { useMemo, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { buildFilterParams } from '@/lib/filters'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface VendorScore {
  vendorName: string
  totalSites: number
  readinessCount: number
  activatedCount: number
  forecastCount: number
  readinessVsForecast: number
  activatedVsForecast: number
  aboveAccelerationActivated: number
  firstTimeRight: number
  totalScore: number
  rank: number
}

interface UseVendorLeaderboardOptions {
  filter?: FilterValue
}

interface UseVendorLeaderboardReturn {
  data: VendorScore[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  totalVendors: number
}

export function useVendorLeaderboard(options: UseVendorLeaderboardOptions = {}): UseVendorLeaderboardReturn {
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
    return `vendor-leaderboard-${JSON.stringify(filter)}`
  }, [filter])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    // Build URL with consistent filter parameters
    const params = buildFilterParams(filter)
    const url = `/api/hermes-5g/vendor-leaderboard?${params.toString()}`

    const response = await fetchWithRetry(url, {}, 3)

    const result = await response.json()
    
    if (result.status === 'success') {
      return {
        data: result.data || [],
        totalVendors: result.totalVendors || 0
      }
    } else {
      throw new Error(result.message || 'Failed to fetch vendor leaderboard data')
    }
  }, [filter])

  // Use useApiCache dengan validasi
  // useApiCache akan otomatis refetch saat cacheKey berubah, tidak perlu useEffect manual
  const { data: cachedData, loading, error, refetch: cacheRefetch } = useApiCache<{ data: VendorScore[], totalVendors: number }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        // Empty data akan di-cache dengan expiry lebih pendek (1 menit)
        const typedData = data as { data?: VendorScore[], totalVendors?: number }
        return data !== null && data !== undefined && typeof data === 'object' && Array.isArray(typedData.data)
      }
    }
  )

  return {
    data: cachedData?.data || [],
    loading,
    error: error ? new Error(error) : null,
    refetch: cacheRefetch,
    totalVendors: cachedData?.totalVendors || 0
  }
}

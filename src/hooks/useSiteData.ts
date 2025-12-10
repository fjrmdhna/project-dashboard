"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { Row } from '@/components/cards/MatrixStatsCard'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

interface UseSiteDataOptions {
  initialFilter?: FilterValue
}

interface UseSiteDataReturn {
  rows: Row[]
  loading: boolean
  error: Error | null
  count: number
  refetch: () => Promise<void>
  filter: FilterValue
  updateFilter: (filter: FilterValue) => void
}

export function useSiteData(options: UseSiteDataOptions = {}): UseSiteDataReturn {
  const [filter, setFilter] = useState<FilterValue>(
    options.initialFilter || {
      q: '',
      vendor_name: [],
      program_report: [],
      imp_ttp: [],
      nano_cluster: [],
      status: []
    }
  )
  
  // Generate cache key dari filter state
  const cacheKey = useMemo(() => {
    return `site-data-${JSON.stringify(filter)}`
  }, [filter])

  // Fungsi untuk membangun URL dengan filter
  const buildUrl = useCallback((filter: FilterValue) => {
    const params = new URLSearchParams()
    if (filter.q) params.append('q', filter.q)
    filter.vendor_name.forEach(vendor => params.append('vendor_name', vendor))
    filter.program_report.forEach(program => params.append('program_report', program))
    filter.imp_ttp.forEach(city => params.append('imp_ttp', city))
    filter.nano_cluster.forEach(cluster => params.append('nano_cluster', cluster))
    // ran_score filter removed - no longer used
    const qs = params.toString()
    return qs ? `/api/hermes-5g/site-data?${qs}` : '/api/hermes-5g/site-data'
  }, [])
  
  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    const url = buildUrl(filter)
    console.log('Fetching site data with filter:', filter)
    const response = await fetchWithRetry(url, {}, 3)
    
    const data = await response.json()
    
    if (data.status === 'success') {
      console.log('Site data fetched successfully:', data.count, 'records')
      return {
        rows: data.data || [],
        count: data.count || 0
      }
    } else {
      throw new Error(data.message || 'Unknown error')
    }
  }, [filter, buildUrl])

  // Use useApiCache dengan validasi
  // useApiCache akan otomatis refetch saat cacheKey berubah, tidak perlu useEffect manual
  const { data, loading, error, refetch: cacheRefetch } = useApiCache<{ rows: Row[], count: number }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        // Empty data akan di-cache dengan expiry lebih pendek (1 menit)
        const typedData = data as { rows?: Row[], count?: number }
        return data !== null && data !== undefined && typeof data === 'object' && Array.isArray(typedData.rows)
      }
    }
  )
  
  // Fungsi untuk refetch data dengan filter saat ini
  const refetch = useCallback(async () => {
    await cacheRefetch()
  }, [cacheRefetch])
  
  // Fungsi untuk update filter dengan immediate update
  const updateFilter = useCallback((newFilter: FilterValue) => {
    console.log('Filter updated:', newFilter)
    setFilter(newFilter)
  }, [])
  
  return {
    rows: data?.rows || [],
    loading,
    error: error ? new Error(error) : null,
    count: data?.count || 0,
    refetch,
    filter,
    updateFilter
  }
} 

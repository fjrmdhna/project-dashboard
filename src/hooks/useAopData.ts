"use client"

import { useMemo, useCallback } from 'react'
import type { Row as MatrixRow } from '@/components/cards/MatrixStatsCard'
import { useApiCache } from './useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'

export interface AopSiteData extends MatrixRow {
  rfc_approved?: string | null
  pac_accepted_af?: string | null
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

export interface UseAopDataReturn {
  data: AopSiteData[]
  stats: AopDataStats
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface UseAopDataOptions {
  vendorNames?: string[]
  programReports?: string[]
  circles?: string[]
  siteCategories?: string[]
  search?: string
  autoFetch?: boolean
}

export function useAopData(options: UseAopDataOptions = {}): UseAopDataReturn {
  const { vendorNames = [], programReports = [], circles = [], siteCategories = [], search = '' } = options

  // Generate cache key dari filter
  const cacheKey = useMemo(() => {
    return `aop-site-data-${JSON.stringify({ vendorNames, programReports, circles, siteCategories, search })}`
  }, [vendorNames, programReports, circles, siteCategories, search])

  // Fetch function untuk useApiCache dengan retry logic
  const fetchFn = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.append('q', search)
    vendorNames.forEach(v => params.append('vendor_name', v))
    programReports.forEach(p => params.append('program_report', p))
    circles.forEach(c => params.append('region_circle', c))
    siteCategories.forEach(cat => params.append('site_category', cat))

    const url = `/api/aop/site-data?${params.toString()}`
    console.log('Fetching AOP data with filter:', { vendorNames, programReports, circles, siteCategories, search })
    
    const response = await fetchWithRetry(url, {}, 3)
    const result = await response.json()

    if (result.status === 'success') {
      console.log('AOP data fetched successfully:', result.count, 'records')
      return {
        data: result.data || [],
        stats: result.stats || {
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
      }
    } else {
      throw new Error(result.message || 'Failed to fetch AOP data')
    }
  }, [vendorNames, programReports, circles, siteCategories, search])

  // Use useApiCache dengan validasi
  const { data, loading, error, refetch: cacheRefetch } = useApiCache<{ data: AopSiteData[], stats: AopDataStats }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        // Validasi struktur data - cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        const typedData = data as { data?: AopSiteData[], stats?: AopDataStats }
        if (!data || !typedData.data || !typedData.stats) {
          return false
        }
        // Validasi bahwa data adalah array dan stats adalah object
        // Cache data kosong juga (dengan expiry lebih pendek) untuk mencegah refetch berulang
        return Array.isArray(typedData.data) && typeof typedData.stats === 'object'
      }
    }
  )

  // Fungsi untuk refetch data
  const refetch = useCallback(async () => {
    await cacheRefetch()
  }, [cacheRefetch])

  return {
    data: data?.data || [],
    stats: data?.stats || {
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
    },
    loading,
    error: error,
    refetch
  }
}


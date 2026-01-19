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
    // #region agent log
    const fetchStartTime = performance.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:53',message:'API fetch started',data:{vendorNames,programReports,circles,siteCategories,search},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const params = new URLSearchParams()
    if (search) params.append('q', search)
    vendorNames.forEach(v => params.append('vendor_name', v))
    programReports.forEach(p => params.append('program_report', p))
    circles.forEach(c => params.append('region_circle', c))
    siteCategories.forEach(sc => params.append('site_category', sc))

    const url = `/api/aop/site-data?${params.toString()}`
    console.log('Fetching AOP data with filter:', { vendorNames, programReports, circles, siteCategories, search })
    
    const response = await fetchWithRetry(url, {}, 3)
    // #region agent log
    const networkEndTime = performance.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:64',message:'Network response received',data:{networkTime:networkEndTime-fetchStartTime,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const result = await response.json()
    // #region agent log
    const parseEndTime = performance.now();
    fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:67',message:'JSON parsing completed',data:{parseTime:parseEndTime-networkEndTime,dataSize:JSON.stringify(result).length,recordCount:result.data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (result.status === 'success') {
      // #region agent log
      const totalTime = performance.now() - fetchStartTime;
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:70',message:'API fetch completed',data:{totalTime,recordCount:result.count||0,dataSize:JSON.stringify(result.data).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
  // OPTIMIZED: Increase cache time untuk data yang jarang berubah
  const { data, loading, error, refetch: cacheRefetch } = useApiCache<{ data: AopSiteData[], stats: AopDataStats }>(
    cacheKey,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000, // 3 menit (increased from 2)
      cacheTime: 10 * 60 * 1000, // 10 menit (increased from 5)
      refetchOnMount: true,
      validateFn: (data) => {
        // #region agent log
        const validationStart = performance.now();
        // #endregion
        // Validasi struktur data - cache semua valid data (termasuk empty) untuk mencegah infinite refetch
        const typedData = data as { data?: AopSiteData[], stats?: AopDataStats }
        if (!data || !typedData.data || !typedData.stats) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:99',message:'Validation failed',data:{validationTime:performance.now()-validationStart},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          return false
        }
        // Validasi bahwa data adalah array dan stats adalah object
        // Cache data kosong juga (dengan expiry lebih pendek) untuk mencegah refetch berulang
        const isValid = Array.isArray(typedData.data) && typeof typedData.stats === 'object';
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAopData.ts:108',message:'Validation completed',data:{isValid,validationTime:performance.now()-validationStart,dataSize:Array.isArray(typedData.data)?typedData.data.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return isValid;
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


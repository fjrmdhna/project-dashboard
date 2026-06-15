"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"
import type { CafAgingBucket } from "@/lib/caf-status-duration"

export interface CafAgingPayload {
  buckets: Record<CafAgingBucket, number>
  waitingImplementation: number
  pendingAging: number
  totalOpen: number
}

interface CafAgingResponse {
  status: "success"
  data: CafAgingPayload
}

export function useCafAging(filters: CafSiteFilters) {
  const qs = cafFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<CafAgingResponse> => {
    const url = qs ? `/api/caf/aging?${qs}` : "/api/caf/aging"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch CAF aging data")
    }

    return payload as CafAgingResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<CafAgingResponse>(
    `caf-aging:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
    }
  )

  return {
    buckets: data?.data?.buckets ?? {
      under7: 0,
      days8to14: 0,
      days15to30: 0,
      over30: 0,
    },
    waitingImplementation: data?.data?.waitingImplementation ?? 0,
    pendingAging: data?.data?.pendingAging ?? 0,
    totalOpen: data?.data?.totalOpen ?? 0,
    loading,
    error,
    refetch,
  }
}

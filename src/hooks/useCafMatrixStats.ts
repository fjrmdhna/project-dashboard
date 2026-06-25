"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"

interface CafMatrixStatsPayload {
  totalCaf: number
  inReview: number
  approved: number
  implemented: number
  rejected: number
  notConfirmed: number
  resubmit: number
}

interface CafMatrixStatsResponse {
  status: "success"
  data: CafMatrixStatsPayload
}

export function useCafMatrixStats(filters: CafSiteFilters) {
  const qs = cafFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<CafMatrixStatsResponse> => {
    const url = qs ? `/api/caf/matrix-stats?${qs}` : "/api/caf/matrix-stats"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch CAF matrix stats")
    }

    return payload as CafMatrixStatsResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<CafMatrixStatsResponse>(
    `caf-matrix-stats:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
    }
  )

  return {
    totalCaf: data?.data?.totalCaf ?? 0,
    inReview: data?.data?.inReview ?? 0,
    approved: data?.data?.approved ?? 0,
    implemented: data?.data?.implemented ?? 0,
    rejected: data?.data?.rejected ?? 0,
    notConfirmed: data?.data?.notConfirmed ?? 0,
    resubmit: data?.data?.resubmit ?? 0,
    loading,
    error,
    refetch,
  }
}

"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface TlpMatrixStatsPayload {
  totalSites: number
  rfi: number
  crfi: number
}

interface TlpMatrixStatsResponse {
  status: "success"
  data: TlpMatrixStatsPayload
}

export function useTlpMatrixStats(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpMatrixStatsResponse> => {
    const url = qs ? `/api/tlp-new-site/matrix-stats?${qs}` : "/api/tlp-new-site/matrix-stats"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch matrix stats")
    }

    return payload as TlpMatrixStatsResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpMatrixStatsResponse>(
    `tlp-new-site-matrix-stats:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const d = (payload as TlpMatrixStatsResponse).data
        return (
          typeof d?.totalSites === "number" &&
          typeof d?.rfi === "number" &&
          typeof d?.crfi === "number"
        )
      },
    }
  )

  return {
    totalSites: data?.data?.totalSites ?? 0,
    rfi: data?.data?.rfi ?? 0,
    crfi: data?.data?.crfi ?? 0,
    loading,
    error,
    refetch,
  }
}

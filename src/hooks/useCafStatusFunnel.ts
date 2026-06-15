"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"

export interface CafStatusFunnelItem {
  status: string
  count: number
}

interface CafStatusFunnelResponse {
  status: "success"
  data: {
    items: CafStatusFunnelItem[]
    totalCaf: number
  }
}

export function useCafStatusFunnel(filters: CafSiteFilters) {
  const qs = cafFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<CafStatusFunnelResponse> => {
    const url = qs ? `/api/caf/status-funnel?${qs}` : "/api/caf/status-funnel"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch CAF status funnel")
    }

    return payload as CafStatusFunnelResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<CafStatusFunnelResponse>(
    `caf-status-funnel:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
    }
  )

  return {
    items: data?.data?.items ?? [],
    totalCaf: data?.data?.totalCaf ?? 0,
    loading,
    error,
    refetch,
  }
}

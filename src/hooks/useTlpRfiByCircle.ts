"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export interface TlpRfiByCircleItem {
  circle: string
  plan: number
  actual: number
  total: number
}

interface TlpRfiByCircleResponse {
  status: "success"
  data: TlpRfiByCircleItem[]
  totalPlanRfi: number
  totalActualRfi: number
  totalSites: number
}

export function useTlpRfiByCircle(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpRfiByCircleResponse> => {
    const url = qs ? `/api/tlp-new-site/rfi-by-circle?${qs}` : "/api/tlp-new-site/rfi-by-circle"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch RFI by circle")
    }

    return payload as TlpRfiByCircleResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpRfiByCircleResponse>(
    `tlp-new-site-rfi-by-circle:v3:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = payload as TlpRfiByCircleResponse
        return (
          Array.isArray(p.data) &&
          typeof p.totalPlanRfi === "number" &&
          typeof p.totalActualRfi === "number"
        )
      },
    }
  )

  return {
    data: data?.data ?? [],
    totalPlanRfi: data?.totalPlanRfi ?? 0,
    totalActualRfi: data?.totalActualRfi ?? 0,
    totalSites: data?.totalSites ?? 0,
    loading,
    error,
    refetch,
  }
}

"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export interface TlpRfiByRegionItem {
  region: string
  rfi: number
  total: number
}

interface TlpRfiByRegionResponse {
  status: "success"
  data: TlpRfiByRegionItem[]
  totalRfi: number
  totalSites: number
}

export function useTlpRfiByRegion(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpRfiByRegionResponse> => {
    const url = qs ? `/api/tlp-new-site/rfi-by-region?${qs}` : "/api/tlp-new-site/rfi-by-region"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch RFI by region")
    }

    return payload as TlpRfiByRegionResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpRfiByRegionResponse>(
    `tlp-new-site-rfi-by-region:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) =>
        Array.isArray((payload as TlpRfiByRegionResponse).data),
    }
  )

  return {
    data: data?.data ?? [],
    totalRfi: data?.totalRfi ?? 0,
    totalSites: data?.totalSites ?? 0,
    loading,
    error,
    refetch,
  }
}

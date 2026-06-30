"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import type { TlpSiteReturnPayload } from "@/lib/tlp-site-return"

interface TlpSiteReturnResponse {
  status: "success"
  data: TlpSiteReturnPayload
}

export function useTlpSiteReturn(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpSiteReturnResponse> => {
    const url = qs ? `/api/tlp-new-site/site-return?${qs}` : "/api/tlp-new-site/site-return"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch site return data")
    }

    return payload as TlpSiteReturnResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpSiteReturnResponse>(
    `tlp-new-site-site-return:v2:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = (payload as TlpSiteReturnResponse).data
        return Array.isArray(p?.rows) && Array.isArray(p?.statuses) && typeof p?.grandTotal === "number"
      },
    }
  )

  return {
    statuses: data?.data?.statuses ?? [],
    rows: data?.data?.rows ?? [],
    statusTotals: data?.data?.statusTotals ?? {},
    woReleasedTotal: data?.data?.woReleasedTotal ?? 0,
    inProcessTotal: data?.data?.inProcessTotal ?? 0,
    grandTotal: data?.data?.grandTotal ?? 0,
    skippedWithoutStatus: data?.data?.skippedWithoutStatus ?? 0,
    loading,
    error,
    refetch,
  }
}

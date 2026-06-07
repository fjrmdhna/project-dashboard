"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export type TlpRfiCrfiGapItem = {
  issueCategory: string
  count: number
}

type TlpRfiCrfiGapResponse = {
  status: "success"
  data: TlpRfiCrfiGapItem[]
  totalGap: number
}

export function useTlpRfiCrfiGap(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpRfiCrfiGapResponse> => {
    const url = qs ? `/api/tlp-new-site/rfi-crfi-gap?${qs}` : "/api/tlp-new-site/rfi-crfi-gap"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch RFI–CRFI gap")
    }

    return payload as TlpRfiCrfiGapResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpRfiCrfiGapResponse>(
    `tlp-new-site-rfi-crfi-gap:v1:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = payload as TlpRfiCrfiGapResponse
        return Array.isArray(p.data) && typeof p.totalGap === "number"
      },
    }
  )

  return {
    rows: data?.data ?? [],
    totalGap: data?.totalGap ?? 0,
    loading,
    error,
    refetch,
  }
}

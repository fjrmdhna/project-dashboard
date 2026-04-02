"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import {
  trimAccProgressPointsWithNoActivity,
  type AccProgressPoint,
} from "@/lib/tlp-acc-progress"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface AccProgressResponse {
  status: "success"
  data: AccProgressPoint[]
}

export function useTlpAccProgressCurve(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<AccProgressResponse> => {
    const url = qs ? `/api/tlp-new-site/acc-progress-curve?${qs}` : "/api/tlp-new-site/acc-progress-curve"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch ACC progress curve")
    }

    return payload as AccProgressResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<AccProgressResponse>(
    `tlp-new-site-acc-progress-curve:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) =>
        Array.isArray((payload as AccProgressResponse).data),
    }
  )

  const points = trimAccProgressPointsWithNoActivity(data?.data ?? [])

  return {
    data: points,
    loading,
    error,
    refetch,
  }
}

"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export type AdminBottleneckItem = {
  status: string
  count: number
}

type AdminBottleneckResponse = {
  status: "success"
  data: AdminBottleneckItem[]
  total: number
}

export function useTlpAdminBottleneck(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<AdminBottleneckResponse> => {
    const url = qs ? `/api/tlp-new-site/admin-bottleneck?${qs}` : "/api/tlp-new-site/admin-bottleneck"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch administration bottleneck")
    }

    return payload as AdminBottleneckResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<AdminBottleneckResponse>(
    `tlp-new-site-admin-bottleneck:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => Array.isArray((payload as AdminBottleneckResponse).data),
    }
  )

  return {
    rows: data?.data ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  }
}


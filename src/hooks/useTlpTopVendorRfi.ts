"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

export interface TlpTopVendorRfiItem {
  vendor: string
  rfi: number
}

interface TlpTopVendorRfiResponse {
  status: "success"
  data: TlpTopVendorRfiItem[]
  totalRfi: number
}

export function useTlpTopVendorRfi(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpTopVendorRfiResponse> => {
    const url = qs ? `/api/tlp-new-site/top-vendor-rfi?${qs}` : "/api/tlp-new-site/top-vendor-rfi"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch top vendor RFI")
    }

    return payload as TlpTopVendorRfiResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpTopVendorRfiResponse>(
    `tlp-new-site-top-vendor-rfi:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) =>
        Array.isArray((payload as TlpTopVendorRfiResponse).data),
    }
  )

  return {
    data: data?.data ?? [],
    totalRfi: data?.totalRfi ?? 0,
    loading,
    error,
    refetch,
  }
}

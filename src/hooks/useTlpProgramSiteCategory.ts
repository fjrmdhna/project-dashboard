"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import type { TlpProgramSiteCategoryPayload } from "@/lib/tlp-program-site-category"

interface TlpProgramSiteCategoryResponse {
  status: "success"
  data: TlpProgramSiteCategoryPayload
}

export function useTlpProgramSiteCategory(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpProgramSiteCategoryResponse> => {
    const url = qs
      ? `/api/tlp-new-site/program-site-category?${qs}`
      : "/api/tlp-new-site/program-site-category"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch program site category")
    }

    return payload as TlpProgramSiteCategoryResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpProgramSiteCategoryResponse>(
    `tlp-new-site-program-site-category:v5:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = (payload as TlpProgramSiteCategoryResponse).data
        return Array.isArray(p?.groups) && Array.isArray(p?.categories) && typeof p?.grandTotal === "number"
      },
    }
  )

  return {
    categories: data?.data?.categories ?? [],
    groups: data?.data?.groups ?? [],
    projectsByGroup: data?.data?.projectsByGroup ?? {},
    grandTotal: data?.data?.grandTotal ?? 0,
    loading,
    error,
    refetch,
  }
}

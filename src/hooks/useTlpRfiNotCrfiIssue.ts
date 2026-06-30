"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import type { TlpRfiNotCrfiIssuePayload } from "@/lib/tlp-rfi-not-crfi-issue"

interface TlpRfiNotCrfiIssueResponse {
  status: "success"
  data: TlpRfiNotCrfiIssuePayload
}

export function useTlpRfiNotCrfiIssue(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpRfiNotCrfiIssueResponse> => {
    const url = qs ? `/api/tlp-new-site/rfi-not-crfi-issue?${qs}` : "/api/tlp-new-site/rfi-not-crfi-issue"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch RFI not CRFI issues")
    }

    return payload as TlpRfiNotCrfiIssueResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpRfiNotCrfiIssueResponse>(
    `tlp-new-site-rfi-not-crfi-issue:v3:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = (payload as TlpRfiNotCrfiIssueResponse).data
        return Array.isArray(p?.rows) && Array.isArray(p?.regions) && typeof p?.totalIssues === "number"
      },
    }
  )

  return {
    rows: data?.data?.rows ?? [],
    regions: data?.data?.regions ?? [],
    totalIssues: data?.data?.totalIssues ?? 0,
    skippedWithoutRanVendor: data?.data?.skippedWithoutRanVendor ?? 0,
    loading,
    error,
    refetch,
  }
}

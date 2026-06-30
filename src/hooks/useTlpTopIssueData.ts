"use client"

import { useCallback, useMemo } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import type { TlpIssueCategoryRow } from "@/lib/tlp-issue-category"
import { tlpFiltersCacheKeySuffix, tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface TlpIssuePayload {
  status: "success"
  data: TlpIssueCategoryRow[]
  categoryCount: number
  filteredTotalCount: number
}

export function useTlpTopIssueData(filters: TlpSiteFilters) {
  const qs = useMemo(() => tlpFiltersToQueryString(filters), [filters])
  const cacheKey = useMemo(
    () => `tlp-new-site-issues:v2:${tlpFiltersCacheKeySuffix(filters) || "all"}`,
    [filters]
  )

  const fetchFn = useCallback(async (): Promise<TlpIssuePayload> => {
    const url = qs ? `/api/tlp-new-site/top-5-issue?${qs}` : "/api/tlp-new-site/top-5-issue"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch issues")
    }

    return payload as TlpIssuePayload
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpIssuePayload>(cacheKey, fetchFn, {
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnMount: true,
    validateFn: (payload) => {
      const p = payload as TlpIssuePayload
      return p?.status === "success" && Array.isArray(p.data) && typeof p.filteredTotalCount === "number"
    },
  })

  return {
    issues: data?.data ?? [],
    categoryCount: data?.categoryCount ?? 0,
    totalIssues: data?.filteredTotalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

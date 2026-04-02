"use client"

import { useCallback, useMemo } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import type { TopIssue } from "@/hooks/useTopIssueData"
import { tlpFiltersCacheKeySuffix, tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface TlpTopIssuePayload {
  status: "success"
  data: TopIssue[]
  top5Count: number
  filteredTotalCount: number
}

export function useTlpTopIssueData(filters: TlpSiteFilters) {
  const qs = useMemo(() => tlpFiltersToQueryString(filters), [filters])
  const cacheKey = useMemo(
    () => `tlp-new-site-top-5-issue:${tlpFiltersCacheKeySuffix(filters) || "all"}`,
    [filters]
  )

  const fetchFn = useCallback(async (): Promise<TlpTopIssuePayload> => {
    const url = qs ? `/api/tlp-new-site/top-5-issue?${qs}` : "/api/tlp-new-site/top-5-issue"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch top issues")
    }

    return payload as TlpTopIssuePayload
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpTopIssuePayload>(cacheKey, fetchFn, {
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnMount: true,
    validateFn: (payload) => {
      const p = payload as TlpTopIssuePayload
      return p?.status === "success" && Array.isArray(p.data) && typeof p.filteredTotalCount === "number"
    },
  })

  return {
    issues: data?.data ?? [],
    topIssuesTotal: data?.top5Count ?? 0,
    totalIssues: data?.filteredTotalCount ?? 0,
    loading,
    error,
    refetch,
  }
}


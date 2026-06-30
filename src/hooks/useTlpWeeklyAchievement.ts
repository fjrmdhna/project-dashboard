"use client"

import { useCallback } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { tlpFiltersToQueryString, type TlpSiteFilters } from "@/lib/tlp-new-site-filters"
import type { TlpWeeklyAchievementPayload } from "@/lib/tlp-weekly-achievement"

interface TlpWeeklyAchievementResponse {
  status: "success"
  data: TlpWeeklyAchievementPayload
}

export function useTlpWeeklyAchievement(filters: TlpSiteFilters) {
  const qs = tlpFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<TlpWeeklyAchievementResponse> => {
    const url = qs
      ? `/api/tlp-new-site/weekly-achievement?${qs}`
      : "/api/tlp-new-site/weekly-achievement"
    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(payload?.error || payload?.message || "Failed to fetch weekly achievement")
    }

    return payload as TlpWeeklyAchievementResponse
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<TlpWeeklyAchievementResponse>(
    `tlp-new-site-weekly-achievement:v1:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => {
        const p = (payload as TlpWeeklyAchievementResponse).data
        return Array.isArray(p?.weeks) && typeof p?.monthLabel === "string" && !!p?.mtd
      },
    }
  )

  return {
    monthLabel: data?.data?.monthLabel ?? "",
    weeks: data?.data?.weeks ?? [],
    mtd: data?.data?.mtd ?? {
      crfi: 0,
      rfi: 0,
      construction: 0,
      rfc: 0,
      sitac: 0,
      searching: 0,
      returnCount: 0,
    },
    loading,
    error,
    refetch,
  }
}

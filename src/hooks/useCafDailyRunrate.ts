"use client"

import { useCallback, useMemo } from "react"
import { format, subDays } from "date-fns"
import { useApiCache } from "@/hooks/useApiCache"
import { cafFiltersToQueryString, type CafSiteFilters } from "@/lib/caf-filters"
import type { AopDailyRunrateItem } from "@/hooks/useAopDailyRunrateData"

interface CafDailyRunrateResponse {
  status: "success"
  data: AopDailyRunrateItem[]
}

export function useCafDailyRunrate(filters: CafSiteFilters) {
  const qs = cafFiltersToQueryString(filters)

  const fetchFn = useCallback(async (): Promise<AopDailyRunrateItem[]> => {
    const url = qs ? `/api/caf/daily-runrate?${qs}` : "/api/caf/daily-runrate"
    const response = await fetch(url)
    const payload: CafDailyRunrateResponse = await response.json()

    if (!response.ok || payload?.status !== "success") {
      throw new Error(
        (payload as { message?: string }).message || "Failed to fetch CAF daily runrate"
      )
    }

    return payload.data ?? []
  }, [qs])

  const { data, loading, error, refetch } = useApiCache<AopDailyRunrateItem[]>(
    `caf-daily-runrate:${qs || "all"}`,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000,
      cacheTime: 5 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => Array.isArray(payload),
    }
  )

  const fallbackData: AopDailyRunrateItem[] = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(today, 6 - i), "dd-MMM-yy"),
      forecast: 0,
      actual: 0,
    }))
  }, [])

  return {
    data: data ?? (error ? fallbackData : []),
    loading,
    error,
    refetch,
  }
}

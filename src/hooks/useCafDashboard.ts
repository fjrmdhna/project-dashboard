"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { filterCafRows, type CafSiteFilters, type CafFilterableRow } from "@/lib/caf-filters"
import { aggregateCafDashboard } from "@/lib/caf-dashboard-aggregate"

interface CafSiteDataResponse {
  status: "success"
  data: CafFilterableRow[]
}

export function useCafDashboard(filters: CafSiteFilters) {
  const hasLoadedOnceRef = useRef(false)

  const fetchFn = useCallback(async (): Promise<CafFilterableRow[]> => {
    const response = await fetch("/api/caf/site-data")
    const payload: CafSiteDataResponse = await response.json()

    if (!response.ok || payload?.status !== "success" || !Array.isArray(payload.data)) {
      throw new Error(
        (payload as { message?: string }).message || "Failed to fetch CAF site data"
      )
    }

    hasLoadedOnceRef.current = true
    return payload.data
  }, [])

  const { data: baseRows, loading: baseLoading, error, refetch } = useApiCache<CafFilterableRow[]>(
    "caf-site-data-all-v2",
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: true,
      validateFn: (payload) => Array.isArray(payload) && payload.length > 0,
    }
  )

  useEffect(() => {
    if (baseRows && baseRows.length > 0) {
      hasLoadedOnceRef.current = true
    }
  }, [baseRows])

  const dashboard = useMemo(() => {
    if (!baseRows || baseRows.length === 0) return null
    const filteredRows = filterCafRows(baseRows, filters)
    return aggregateCafDashboard(filteredRows)
  }, [baseRows, filters])

  const matrix = dashboard?.matrix
  const statusFunnel = dashboard?.statusFunnel
  const aging = dashboard?.aging

  const loading = baseLoading && !hasLoadedOnceRef.current

  return {
    hasData: Boolean(baseRows && baseRows.length > 0),
    totalCaf: matrix?.totalCaf ?? 0,
    inReview: matrix?.inReview ?? 0,
    approved: matrix?.approved ?? 0,
    implemented: matrix?.implemented ?? 0,
    rejected: matrix?.rejected ?? 0,
    notConfirmed: matrix?.notConfirmed ?? 0,
    resubmit: matrix?.resubmit ?? 0,
    statusItems: statusFunnel?.items ?? [],
    funnelTotal: statusFunnel?.totalCaf ?? 0,
    buckets: aging?.buckets ?? {
      under7: 0,
      days8to14: 0,
      days15to30: 0,
      over30: 0,
    },
    waitingImplementation: aging?.waitingImplementation ?? 0,
    pendingAging: aging?.pendingAging ?? 0,
    totalOpen: aging?.totalOpen ?? 0,
    milestoneAlignment: dashboard?.milestoneAlignment ?? {
      missingRfs: 0,
      missingEndorse: 0,
      missingPatp: 0,
      allComplete: 0,
      totalCaf: 0,
    },
    runrateData: dashboard?.dailyRunrate ?? [],
    topVendorRequestor: dashboard?.topVendorRequestor ?? [],
    topVendorTlp: dashboard?.topVendorTlp ?? [],
    loading,
    error,
    refetch,
  }
}

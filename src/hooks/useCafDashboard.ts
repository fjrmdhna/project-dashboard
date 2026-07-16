"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import {
  deriveCafFilterOptionsFromRows,
  EMPTY_CAF_FILTER_OPTIONS,
  filterCafRows,
  type CafSiteFilters,
  type CafFilterableRow,
} from "@/lib/caf-filters"
import { aggregateCafDashboard } from "@/lib/caf-dashboard-aggregate"
import { createEmptyCafNeedFollowupData } from "@/lib/caf-need-followup"
import { createEmptyCafPicPendingData } from "@/lib/caf-pic-pending"
import { createEmptyCafStatusBreakdown } from "@/lib/caf-status-registry"

const EMPTY_PIC_PENDING = createEmptyCafPicPendingData()
const EMPTY_NEED_FOLLOWUP = createEmptyCafNeedFollowupData()
const EMPTY_STATUS_BREAKDOWN = createEmptyCafStatusBreakdown()

interface CafSiteDataResponse {
  status: "success"
  data: CafFilterableRow[]
}

export function useCafDashboard(filters: CafSiteFilters) {
  const hasLoadedOnceRef = useRef(false)
  const dashboardCacheRef = useRef<ReturnType<typeof aggregateCafDashboard> | null>(null)

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
    "caf-site-data-all-v3",
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

  const filterOptions = useMemo(() => {
    if (!baseRows || baseRows.length === 0) return EMPTY_CAF_FILTER_OPTIONS
    return deriveCafFilterOptionsFromRows(baseRows)
  }, [baseRows])

  const dashboard = useMemo(() => {
    if (!baseRows || baseRows.length === 0) return dashboardCacheRef.current
    const filteredRows = filterCafRows(baseRows, filters)
    const result = aggregateCafDashboard(filteredRows)
    dashboardCacheRef.current = result
    return result
  }, [baseRows, filters])

  const matrix = dashboard?.matrix
  const statusFunnel = dashboard?.statusFunnel

  const loading = baseLoading && !hasLoadedOnceRef.current

  return {
    hasData: Boolean(baseRows && baseRows.length > 0),
    filterOptions,
    totalCaf: matrix?.totalCaf ?? 0,
    inReview: matrix?.inReview ?? 0,
    approved: matrix?.approved ?? 0,
    implemented: matrix?.implemented ?? 0,
    rejected: matrix?.rejected ?? 0,
    notConfirmed: matrix?.notConfirmed ?? 0,
    resubmit: matrix?.resubmit ?? 0,
    statusBreakdown: dashboard?.statusBreakdown ?? dashboardCacheRef.current?.statusBreakdown ?? EMPTY_STATUS_BREAKDOWN,
    statusItems: statusFunnel?.items ?? [],
    funnelTotal: statusFunnel?.totalCaf ?? 0,
    statusAssigneeCards: dashboard?.statusAssigneeCards ?? [],
    statusVendorPending: dashboard?.statusVendorPending ?? [],
    pendingFollowupTotal:
      (matrix?.inReview ?? 0) +
      (matrix?.approved ?? 0) +
      (matrix?.notConfirmed ?? 0) +
      (matrix?.other ?? 0),
    picPending: dashboard?.picPending ?? dashboardCacheRef.current?.picPending ?? EMPTY_PIC_PENDING,
    needFollowup: dashboard?.needFollowup ?? dashboardCacheRef.current?.needFollowup ?? EMPTY_NEED_FOLLOWUP,
    runrateData: dashboard?.dailyRunrate ?? [],
    topVendorRequestor: dashboard?.topVendorRequestor ?? [],
    topVendorTlp: dashboard?.topVendorTlp ?? [],
    loading,
    error,
    refetch,
  }
}

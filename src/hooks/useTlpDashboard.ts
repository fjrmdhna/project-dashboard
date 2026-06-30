"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useApiCache } from "@/hooks/useApiCache"
import { aggregateTlpDashboard, type TlpDashboardAggregated } from "@/lib/tlp-dashboard-aggregate"
import type { TlpDashboardRow } from "@/lib/tlp-dashboard-server"
import {
  rowMatchesTlpFilters,
  tlpFiltersCacheKeySuffix,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

interface TlpSiteDataResponse {
  status: "success"
  data: TlpDashboardRow[]
}

const FILTER_DEBOUNCE_MS = 150

const EMPTY_WEEKLY_MTD = {
  crfi: 0,
  rfi: 0,
  construction: 0,
  rfc: 0,
  sitac: 0,
  searching: 0,
  returnCount: 0,
} as const

let inflightSiteData: Promise<TlpDashboardRow[]> | null = null
let tlpDashboardHasLoadedOnce = false
let tlpDashboardCommittedCache: TlpDashboardAggregated | null = null
let tlpAggregateCacheKey = ""
let tlpAggregateCache: TlpDashboardAggregated | null = null

async function fetchTlpSiteDataRows(): Promise<TlpDashboardRow[]> {
  if (inflightSiteData) {
    return inflightSiteData
  }

  inflightSiteData = (async () => {
    const response = await fetch("/api/tlp-new-site/site-data")
    const payload: TlpSiteDataResponse = await response.json()

    if (!response.ok || payload?.status !== "success" || !Array.isArray(payload.data)) {
      throw new Error(
        (payload as { message?: string }).message || "Failed to fetch TLP site data"
      )
    }

    return payload.data
  })()

  try {
    return await inflightSiteData
  } catch (error) {
    inflightSiteData = null
    throw error
  } finally {
    inflightSiteData = null
  }
}

function useDebouncedTlpFilters(filters: TlpSiteFilters, delayMs: number) {
  const filtersKey = tlpFiltersCacheKeySuffix(filters) || "all"
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [debouncedKey, setDebouncedKey] = useState(filtersKey)
  const [isFilterPending, setIsFilterPending] = useState(false)

  useEffect(() => {
    if (filtersKey === debouncedKey) {
      return
    }

    setIsFilterPending(true)
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
      setDebouncedKey(filtersKey)
      setIsFilterPending(false)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [filters, filtersKey, debouncedKey, delayMs])

  return { debouncedFilters, debouncedKey, isFilterPending }
}

export function useTlpDashboard(filters: TlpSiteFilters) {
  const hasLoadedOnceRef = useRef(tlpDashboardHasLoadedOnce)
  const hasCommittedDashboardRef = useRef(Boolean(tlpDashboardCommittedCache))
  const committedDashboardRef = useRef<TlpDashboardAggregated | null>(tlpDashboardCommittedCache)
  const [, startDashboardTransition] = useTransition()
  const [committedDashboard, setCommittedDashboard] = useState<TlpDashboardAggregated | null>(
    () => tlpDashboardCommittedCache
  )

  const { debouncedFilters, debouncedKey, isFilterPending } = useDebouncedTlpFilters(
    filters,
    FILTER_DEBOUNCE_MS
  )

  const fetchFn = useCallback(async (): Promise<TlpDashboardRow[]> => {
    const rows = await fetchTlpSiteDataRows()
    hasLoadedOnceRef.current = true
    tlpDashboardHasLoadedOnce = true
    return rows
  }, [])

  const { data: baseRows, loading: baseLoading, error, refetch } = useApiCache<TlpDashboardRow[]>(
    "tlp-site-data-scoped-v1",
    fetchFn,
    {
      staleTime: 3 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnMount: false,
      validateFn: (payload) => Array.isArray(payload) && payload.length > 0,
    }
  )

  useEffect(() => {
    if (baseRows && baseRows.length > 0) {
      hasLoadedOnceRef.current = true
      tlpDashboardHasLoadedOnce = true
    }
  }, [baseRows])

  const filteredRows = useMemo(() => {
    if (!baseRows || baseRows.length === 0) return []
    return baseRows.filter((row) => rowMatchesTlpFilters(row, debouncedFilters))
  }, [baseRows, debouncedFilters])

  const dashboard = useMemo((): TlpDashboardAggregated | null => {
    if (filteredRows.length === 0) return null

    const cacheKey = `${debouncedKey}:${filteredRows.length}`
    if (tlpAggregateCache && tlpAggregateCacheKey === cacheKey) {
      return tlpAggregateCache
    }

    const result = aggregateTlpDashboard(filteredRows)
    tlpAggregateCacheKey = cacheKey
    tlpAggregateCache = result
    return result
  }, [filteredRows, debouncedKey])

  useEffect(() => {
    committedDashboardRef.current = committedDashboard
  }, [committedDashboard])

  useEffect(() => {
    if (!dashboard || dashboard === committedDashboardRef.current) {
      return
    }

    if (!hasCommittedDashboardRef.current) {
      tlpDashboardCommittedCache = dashboard
      committedDashboardRef.current = dashboard
      setCommittedDashboard(dashboard)
      hasCommittedDashboardRef.current = true
      return
    }

    startDashboardTransition(() => {
      tlpDashboardCommittedCache = dashboard
      committedDashboardRef.current = dashboard
      setCommittedDashboard(dashboard)
    })
  }, [dashboard, startDashboardTransition])

  const isInitialLoading = baseLoading && !hasLoadedOnceRef.current
  const d = committedDashboard

  return {
    matrix: d?.matrix,
    rfiByCircle: d?.rfiByCircle ?? [],
    totalPlanRfi: d?.totalPlanRfi ?? 0,
    totalActualRfi: d?.totalActualRfi ?? 0,
    topVendorRfi: d?.topVendorRfi ?? [],
    accProgress: d?.accProgress ?? [],
    issues: d?.issues ?? [],
    categoryCount: d?.categoryCount ?? 0,
    totalIssues: d?.totalIssues ?? 0,
    programCategories: d?.programSiteCategory.categories ?? [],
    programGroups: d?.programSiteCategory.groups ?? [],
    projectsByGroup: d?.programSiteCategory.projectsByGroup ?? {},
    programGrandTotal: d?.programSiteCategory.grandTotal ?? 0,
    rfiNotCrfiRows: d?.rfiNotCrfi.rows ?? [],
    rfiNotCrfiRegions: d?.rfiNotCrfi.regions ?? [],
    rfiNotCrfiTotal: d?.rfiNotCrfi.totalIssues ?? 0,
    rfiSkippedWithoutVendor: d?.rfiNotCrfi.skippedWithoutRanVendor ?? 0,
    weeklyMonthLabel: d?.weeklyAchievement.monthLabel ?? "",
    weeklyWeeks: d?.weeklyAchievement.weeks ?? [],
    weeklyMtd: d?.weeklyAchievement.mtd ?? EMPTY_WEEKLY_MTD,
    siteReturnStatuses: d?.siteReturn.statuses ?? [],
    siteReturnRows: d?.siteReturn.rows ?? [],
    siteReturnWoReleased: d?.siteReturn.woReleasedTotal ?? 0,
    siteReturnInProcess: d?.siteReturn.inProcessTotal ?? 0,
    siteReturnGrandTotal: d?.siteReturn.grandTotal ?? 0,
    siteReturnSkippedWithoutStatus: d?.siteReturn.skippedWithoutStatus ?? 0,
    committedDashboard: d,
    hasCommittedData: d !== null,
    loading: isInitialLoading,
    isFilterPending,
    error,
    refetch,
  }
}

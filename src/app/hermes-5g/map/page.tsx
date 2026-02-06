"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useApiCache } from '@/hooks/useApiCache'

const Hermes5GMap = dynamic(() => import('@/components/maps/Hermes5GMap').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white/60">Loading map...</p>
      </div>
    </div>
  )
})

import type { HermesMapPoint, StatusLabel } from '@/components/maps/Hermes5GMap'
import { useFilter } from '@/contexts/FilterContext'
import { FilterBar, FilterValue } from '@/components/filters/FilterBar'
import { getProgramReportsForDisplayName } from '@/lib/hermes-program-mapping'
import { normalizeSiteCategoryValue } from '@/lib/supabase'

interface MapApiSuccess {
  status: 'success'
  data: {
    points: HermesMapPoint[]
    counts: Record<StatusLabel, number>
    total: number
    colors: Record<StatusLabel, string>
    invalidCoordinates: number
  }
  timestamp: string
}

interface MapApiError {
  status: 'error'
  message: string
  error?: string
}

type MapApiResponse = MapApiSuccess | MapApiError

const STATUS_ORDER: StatusLabel[] = ['ACTIVE', 'READY', 'RFI', 'SOW']

const DEFAULT_COUNTS: Record<StatusLabel, number> = {
  ACTIVE: 0,
  READY: 0,
  RFI: 0,
  CRFI: 0,
  MOS: 0,
  SOW: 0,
  INSTALL: 0,
  ON_AIR: 0
}

const DEFAULT_COLORS: Record<StatusLabel, string> = {
  ACTIVE: '#22C55E',  // Hijau untuk ACTIVE
  READY: '#2563EB',   // Biru untuk READY
  RFI: '#FACC15',     // Kuning untuk RFI
  CRFI: '#3B82F6',    // Biru untuk CRFI
  MOS: '#8B5CF6',     // Ungu untuk MOS
  SOW: '#EF4444',     // Merah untuk SOW
  INSTALL: '#8B5CF6', // Ungu untuk INSTALL
  ON_AIR: '#06B6D4'   // Cyan untuk ON_AIR
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return 'Not available'
  }

  try {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    })
  } catch (error) {
    console.warn('Failed to format timestamp:', error)
    return timestamp
  }
}

export default function Hermes5GMapPage() {
  // Menggunakan shared filter context
  const filterContext = useFilter()

  // Fetch full map data once (no filter), cache and filter client-side for instant filter changes
  const fetchMapAll = useCallback(async () => {
    const res = await fetch('/api/hermes-5g/map-data', { cache: 'no-store' })
    const json: MapApiResponse = await res.json()
    if (json.status !== 'success') {
      throw new Error(json.message || 'Failed to load map data')
    }
    return json
  }, [])

  const { data: cachedMapResponse, loading, error, refetch } = useApiCache<MapApiSuccess>(
    'hermes-map-all-v1',
    fetchMapAll,
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 15 * 60 * 1000,
      refetchOnMount: false,
      validateFn: (d) => {
        const res = d as MapApiSuccess
        return !!res?.status && res.status === 'success' && Array.isArray(res.data?.points) && res.data?.colors != null && typeof res.data?.invalidCoordinates === 'number'
      }
    }
  )

  const hasInitialLoad = !!cachedMapResponse
  const lastUpdated = cachedMapResponse?.timestamp ?? null
  const invalidCoordinates = cachedMapResponse?.data?.invalidCoordinates ?? 0
  const colors = useMemo(
    () => cachedMapResponse?.data?.colors ?? DEFAULT_COLORS,
    [cachedMapResponse?.data?.colors]
  )

  // Convert debounced filter context to FilterValue format - support multiselect
  const currentFilter: FilterValue = useMemo(() => {
    const debounced = filterContext.debouncedFilters || filterContext
    return {
      q: debounced.searchTerm,
      vendor_name: debounced.vendorFilter !== 'all' ? debounced.vendorFilter.split(',').filter(Boolean) : [],
      program_report: debounced.programFilter !== 'all' ? debounced.programFilter.split(',').filter(Boolean) : [],
      imp_ttp: debounced.cityFilter !== 'all' ? debounced.cityFilter.split(',').filter(Boolean) : [],
      nano_cluster: debounced.nanoClusterFilter !== 'all' ? debounced.nanoClusterFilter.split(',').filter(Boolean) : [],
      region: debounced.regionFilter !== 'all' ? debounced.regionFilter.split(',').filter(Boolean) : [],
      year: debounced.yearFilter !== 'all' ? debounced.yearFilter.split(',').filter(Boolean) : [],
      circle: debounced.circleFilter !== 'all' ? debounced.circleFilter.split(',').filter(Boolean) : [],
      site_category: debounced.siteCategoryFilter !== 'all' ? debounced.siteCategoryFilter.split(',').filter(Boolean) : [],
      status: debounced.statusFilters || []
    }
  }, [filterContext.debouncedFilters])

  // Client-side filter: apply currentFilter to cached points (no extra fetch)
  const { points, counts, totalCounts } = useMemo(() => {
    const raw = cachedMapResponse?.data
    if (!raw?.points?.length) {
      return {
        points: [] as HermesMapPoint[],
        counts: { ...DEFAULT_COUNTS },
        totalCounts: { ...DEFAULT_COUNTS }
      }
    }
    const q = (currentFilter.q ?? '').toLowerCase().trim()
    const vendorSet = currentFilter.vendor_name?.length ? new Set(currentFilter.vendor_name) : null
    const impTtpSet = currentFilter.imp_ttp?.length ? new Set(currentFilter.imp_ttp) : null
    const nanoSet = currentFilter.nano_cluster?.length ? new Set(currentFilter.nano_cluster) : null
    const regionSet = currentFilter.region?.length ? new Set(currentFilter.region) : null
    const yearSet = currentFilter.year?.length ? new Set(currentFilter.year) : null
    const statusSet = currentFilter.status?.length ? new Set(currentFilter.status) : null

    // Program: expand display names to actual program_report values (filter options use display names)
    const allProgramReports = [...new Set(raw.points.map((p: HermesMapPoint) => p.programReport).filter(Boolean))] as string[]
    let programSet: Set<string> | null = null
    if (currentFilter.program_report?.length) {
      const expanded = new Set<string>()
      for (const displayOrRaw of currentFilter.program_report) {
        const resolved = getProgramReportsForDisplayName(displayOrRaw, allProgramReports)
        if (resolved.length) resolved.forEach((r: string) => expanded.add(r))
        else expanded.add(displayOrRaw)
      }
      programSet = expanded.size ? expanded : null
    }

    // Circle: normalize to Title Case for comparison (same as filter options)
    const normalizeCircle = (v: string) => v.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    const circleSet =
      currentFilter.circle?.length ?
        new Set(currentFilter.circle.map(normalizeCircle)) : null

    // Site category: normalize to "New Site" / "Expansion" for comparison
    const siteCategorySet =
      currentFilter.site_category?.length
        ? new Set(currentFilter.site_category.map((sc: string) => normalizeSiteCategoryValue(sc).toLowerCase()))
        : null

    const filtered = raw.points.filter((p: HermesMapPoint) => {
      if (vendorSet && !vendorSet.has(p.vendorName ?? '')) return false
      if (programSet && !programSet.has(p.programReport ?? '')) return false
      if (impTtpSet && !impTtpSet.has(p.impTtp ?? '')) return false
      if (nanoSet && !nanoSet.has(p.nanoCluster ?? '')) return false
      if (regionSet && !regionSet.has(p.region ?? '')) return false
      if (yearSet && !yearSet.has(p.year ?? '')) return false
      if (circleSet) {
        const pCircle = normalizeCircle(p.region_circle ?? '')
        if (!pCircle || !circleSet.has(pCircle)) return false
      }
      if (siteCategorySet) {
        const pCat = normalizeSiteCategoryValue(p.site_category ?? '').toLowerCase()
        if (!pCat || !siteCategorySet.has(pCat)) return false
      }
      if (statusSet && !statusSet.has(p.status)) return false
      if (q) {
        const searchable = [p.id, p.vendorName, p.programReport].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })

    const countsByStatus: Record<string, number> = { ...DEFAULT_COUNTS }
    filtered.forEach((p: HermesMapPoint) => {
      countsByStatus[p.status] = (countsByStatus[p.status] ?? 0) + 1
    })

    // Total counts for summary: same filters but without status filter
    const totalFiltered =
      !statusSet || statusSet.size === 0
        ? filtered
        : raw.points.filter((p: HermesMapPoint) => {
            if (vendorSet && !vendorSet.has(p.vendorName ?? '')) return false
            if (programSet && !programSet.has(p.programReport ?? '')) return false
            if (impTtpSet && !impTtpSet.has(p.impTtp ?? '')) return false
            if (nanoSet && !nanoSet.has(p.nanoCluster ?? '')) return false
            if (regionSet && !regionSet.has(p.region ?? '')) return false
            if (yearSet && !yearSet.has(p.year ?? '')) return false
            if (circleSet) {
              const pCircle = normalizeCircle(p.region_circle ?? '')
              if (!pCircle || !circleSet.has(pCircle)) return false
            }
            if (siteCategorySet) {
              const pCat = normalizeSiteCategoryValue(p.site_category ?? '').toLowerCase()
              if (!pCat || !siteCategorySet.has(pCat)) return false
            }
            if (q) {
              const searchable = [p.id, p.vendorName, p.programReport].filter(Boolean).join(' ').toLowerCase()
              if (!searchable.includes(q)) return false
            }
            return true
          })
    const totalCountsByStatus: Record<string, number> = { ...DEFAULT_COUNTS }
    totalFiltered.forEach((p: HermesMapPoint) => {
      totalCountsByStatus[p.status] = (totalCountsByStatus[p.status] ?? 0) + 1
    })

    return {
      points: filtered as HermesMapPoint[],
      counts: countsByStatus as Record<StatusLabel, number>,
      totalCounts: totalCountsByStatus as Record<StatusLabel, number>
    }
  }, [cachedMapResponse, currentFilter])

  const visiblePoints = useMemo(() => points, [points])

  const totalSitesForSummary = useMemo(() => {
    return Object.values(totalCounts).reduce((sum, count) => sum + count, 0)
  }, [totalCounts])

  // Handler untuk status click
  const handleStatusClick = useCallback((status: StatusLabel) => {
    const currentStatuses = filterContext.statusFilters || []
    const isSelected = currentStatuses.includes(status)
    
    if (isSelected) {
      const newStatuses = currentStatuses.filter(s => s !== status)
      filterContext.setStatusFilters(newStatuses)
    } else {
      const newStatuses = [...currentStatuses, status]
      filterContext.setStatusFilters(newStatuses)
    }
  }, [filterContext])

  const headerTitle = 'Hermes 5G Progress Map'

  // Show loading state until hydration is complete
  if (!filterContext.isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Loading map...</p>
        </div>
      </div>
    )
  }

  const handleFilterChange = (newFilters: FilterValue) => {
    filterContext.setSearchTerm(newFilters.q)
    filterContext.setVendorFilter(newFilters.vendor_name?.length ? newFilters.vendor_name.join(',') : 'all')
    filterContext.setProgramFilter(newFilters.program_report?.length ? newFilters.program_report.join(',') : 'all')
    filterContext.setCityFilter(newFilters.imp_ttp?.length ? newFilters.imp_ttp.join(',') : 'all')
    filterContext.setNanoClusterFilter(newFilters.nano_cluster?.length ? newFilters.nano_cluster.join(',') : 'all')
    filterContext.setRegionFilter(newFilters.region?.length ? newFilters.region.join(',') : 'all')
    filterContext.setYearFilter(newFilters.year?.length ? newFilters.year.join(',') : 'all')
    filterContext.setCircleFilter(newFilters.circle?.length ? newFilters.circle.join(',') : 'all')
    filterContext.setSiteCategoryFilter(newFilters.site_category?.length ? newFilters.site_category.join(',') : 'all')
  }

  const handleFilterReset = () => {
    filterContext.resetFilters()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white relative">
      <header className="border-b border-white/10 bg-[#0B1533]/70 backdrop-blur transition-opacity duration-300">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src="/logo-indosat-putih.png" alt="Indosat Ooredoo" className="h-9" />
            <div className="hidden flex-col lg:flex">
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/60">Hermes 5G Dashboard</span>
              <h1 className="text-xl font-semibold tracking-wide text-white">{headerTitle}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-2 text-xs uppercase tracking-[0.32em] text-white/60 lg:justify-center">
            <Link
              href="/hermes-5g"
              className="rounded-full border border-white/15 px-4 py-1.5 font-medium text-white/80 transition hover:bg-white/10"
            >
              Overview
            </Link>
            <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-4 py-1.5 font-semibold text-[#34D399]">
              Map
            </span>
          </div>

          <div className="flex flex-col items-end gap-2 text-right text-xs text-white/60">
            <div>{formatTimestamp(lastUpdated)}</div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 transition hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-120px)] max-w-[1440px] flex-col gap-5 px-6 py-5 lg:h-[calc(100vh-140px)] transition-opacity duration-300">
        {/* Filter Bar */}
        <div className="rounded-2xl border border-white/10 bg-[#0B1533]/60 p-4">
          <FilterBar
            value={currentFilter}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
        </div>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#0B1533]/60">
            <Hermes5GMap points={visiblePoints} colors={colors} loading={loading} error={error} />
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0B1533]/60 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Status Summary</h2>
              {loading || !hasInitialLoad ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                  <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                  <span>Loading summary...</span>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {totalSitesForSummary.toLocaleString('en-US')} Sites
                  </p>
                  {invalidCoordinates > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-xs font-medium text-amber-200">
                          {invalidCoordinates} sites with invalid coordinates
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 text-sm">
              {STATUS_ORDER.map((status) => {
                const color = colors[status] ?? '#94A3B8'
                const value = totalCounts[status] ?? 0  // Use totalCounts instead of counts
                const percentage = totalSitesForSummary > 0 ? Math.round((value / totalSitesForSummary) * 100) : 0
                const isSelected = (filterContext.statusFilters || []).includes(status)

                return (
                  <div 
                    key={status} 
                    className={`flex items-center justify-between gap-3 rounded-lg p-2 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                      isSelected ? 'bg-white/10 ring-1 ring-white/20' : ''
                    }`}
                    onClick={() => handleStatusClick(status)}
                    title={`Click to ${isSelected ? 'remove' : 'add'} ${status} filter`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className={`text-xs font-medium tracking-[0.24em] ${
                        isSelected ? 'text-white' : 'text-white/70'
                      }`}>{status}</span>
                    </div>
                    <div className="flex items-baseline gap-2 font-semibold">
                      <span className="text-base text-white">{value.toLocaleString('en-US')}</span>
                      <span className="text-[11px] text-white/50">{percentage}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[11px] leading-relaxed text-white/70">
              <p className="font-semibold uppercase tracking-[0.26em] text-white/80">Status Legend</p>
              <ul className="mt-3 space-y-2">
                <li><span className="font-semibold text-white">ACTIVE</span> - Site is fully activated.</li>
                <li><span className="font-semibold text-white">READY</span> - Site has completed readiness tasks.</li>
                <li><span className="font-semibold text-white">RFI</span> - CAF acceptance received.</li>
                <li><span className="font-semibold text-white">SOW</span> - Total registered scope of work.</li>
              </ul>
              {invalidCoordinates > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-amber-300 font-medium">
                    {invalidCoordinates} sites are excluded from the map because of invalid coordinates.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-100">
                Failed to load map data: {error}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'

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
  SOW: 0,
  INSTALL: 0,
  ON_AIR: 0
}

const DEFAULT_COLORS: Record<StatusLabel, string> = {
  ACTIVE: '#22C55E',  // Hijau untuk ACTIVE
  READY: '#2563EB',   // Biru untuk READY
  RFI: '#FACC15',     // Kuning untuk RFI
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
  
  const [points, setPoints] = useState<HermesMapPoint[]>([])
  const [counts, setCounts] = useState<Record<StatusLabel, number>>(() => ({ ...DEFAULT_COUNTS }))
  const [totalCounts, setTotalCounts] = useState<Record<StatusLabel, number>>(() => ({ ...DEFAULT_COUNTS })) // Total counts untuk status summary
  const [colors, setColors] = useState<Record<StatusLabel, string>>(() => ({ ...DEFAULT_COLORS }))
  const [invalidCoordinates, setInvalidCoordinates] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFilterLoading, setIsFilterLoading] = useState(false) // State khusus untuk filter loading (hanya saat filter berubah)
  const [hasInitialLoad, setHasInitialLoad] = useState(false) // Track initial load completion
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(true)
  
  // Convert filter context to FilterValue format - support multiselect
  const currentFilter: FilterValue = useMemo(() => ({
    q: filterContext.searchTerm,
    vendor_name: filterContext.vendorFilter !== 'all' ? filterContext.vendorFilter.split(',').filter(Boolean) : [],
    program_report: filterContext.programFilter !== 'all' ? filterContext.programFilter.split(',').filter(Boolean) : [],
    imp_ttp: filterContext.cityFilter !== 'all' ? filterContext.cityFilter.split(',').filter(Boolean) : [],
    nano_cluster: filterContext.nanoClusterFilter !== 'all' ? filterContext.nanoClusterFilter.split(',').filter(Boolean) : [],
    region: filterContext.regionFilter !== 'all' ? filterContext.regionFilter.split(',').filter(Boolean) : [],
    year: filterContext.yearFilter !== 'all' ? filterContext.yearFilter.split(',').filter(Boolean) : [],
    status: filterContext.statusFilters || []
  }), [filterContext.searchTerm, filterContext.vendorFilter, filterContext.programFilter, filterContext.cityFilter, filterContext.nanoClusterFilter, filterContext.regionFilter, filterContext.yearFilter, filterContext.statusFilters])

  const visiblePoints = useMemo(
    () => (showExcluded ? points : points.filter(point => !point.isExcluded)),
    [points, showExcluded]
  )

  const totalSitesForSummary = useMemo(() => {
    return Object.values(totalCounts).reduce((sum, count) => sum + count, 0)
  }, [totalCounts])

  // Handler untuk status click
  const handleStatusClick = useCallback((status: StatusLabel) => {
    const currentStatuses = filterContext.statusFilters || []
    const isSelected = currentStatuses.includes(status)
    
    if (isSelected) {
      // Remove status dari filter
      const newStatuses = currentStatuses.filter(s => s !== status)
      filterContext.setStatusFilters(newStatuses)
    } else {
      // Add status ke filter
      const newStatuses = [...currentStatuses, status]
      filterContext.setStatusFilters(newStatuses)
    }
  }, [filterContext])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setIsFilterLoading(true) // Set filter loading state
      setError(null)

      // Build URL with current filter
      const params = new URLSearchParams()
      if (currentFilter.q) {
        params.set('q', currentFilter.q)
      }
      currentFilter.vendor_name.forEach((value) => {
        params.append('vendor_name', value)
      })
      currentFilter.program_report.forEach((value) => {
        params.append('program_report', value)
      })
      currentFilter.imp_ttp.forEach((value) => {
        params.append('imp_ttp', value)
      })
      currentFilter.nano_cluster.forEach((value) => {
        params.append('nano_cluster', value)
      })
      currentFilter.region?.forEach((value) => {
        params.append('region', value)
      })
      currentFilter.year?.forEach((value) => {
        params.append('year', value)
      })
      currentFilter.status.forEach((value) => {
        params.append('status', value)
      })

      const url = `/api/hermes-5g/map-data?${params.toString()}`
      console.log('Loading map data with filter:', currentFilter)
      console.log('Map API URL:', url)
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload: MapApiResponse = await response.json()

      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to load map data')
      }

      setPoints(payload.data.points)
      setCounts(payload.data.counts as Record<StatusLabel, number>)
      setColors(payload.data.colors as Record<StatusLabel, string>)
      setInvalidCoordinates(payload.data.invalidCoordinates || 0)
      setLastUpdated(payload.timestamp)
      setHasInitialLoad(true) // Mark initial load as complete

      // Load total counts for status summary (without status filter)
      if (currentFilter.status.length > 0) {
        try {
          const totalParams = new URLSearchParams()
          if (currentFilter.q) {
            totalParams.set('q', currentFilter.q)
          }
          currentFilter.vendor_name.forEach((value) => {
            totalParams.append('vendor_name', value)
          })
          currentFilter.program_report.forEach((value) => {
            totalParams.append('program_report', value)
          })
          currentFilter.imp_ttp.forEach((value) => {
            totalParams.append('imp_ttp', value)
          })
          currentFilter.nano_cluster.forEach((value) => {
            totalParams.append('nano_cluster', value)
          })
          currentFilter.region?.forEach((value) => {
            totalParams.append('region', value)
          })
          currentFilter.year?.forEach((value) => {
            totalParams.append('year', value)
          })
          // Don't include status filter for total counts

          const totalUrl = `/api/hermes-5g/map-data?${totalParams.toString()}`
          const totalResponse = await fetch(totalUrl, { cache: 'no-store' })
          
          if (totalResponse.ok) {
            const totalPayload: MapApiResponse = await totalResponse.json()
            if (totalPayload.status === 'success') {
              setTotalCounts(totalPayload.data.counts as Record<StatusLabel, number>)
            }
          }
        } catch (err) {
          console.warn('Failed to load total counts for status summary:', err)
          // Keep existing totalCounts if failed
        }
      } else {
        // If no status filter, use the same counts
        setTotalCounts(payload.data.counts as Record<StatusLabel, number>)
      }
    } catch (err) {
      console.error('Failed to load Hermes 5G map data:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setPoints([])
      setCounts({ ...DEFAULT_COUNTS })
      setTotalCounts({ ...DEFAULT_COUNTS })
      setColors({ ...DEFAULT_COLORS })
      setInvalidCoordinates(0)
    } finally {
      setLoading(false)
      setIsFilterLoading(false) // Clear filter loading state
    }
  }, [currentFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

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

  // Handler untuk perubahan filter
  const handleFilterChange = (newFilters: FilterValue) => {
    console.log("Filter changed:", newFilters)
    // Set filter loading state immediately untuk memberikan feedback visual yang cepat
    setIsFilterLoading(true)
    // Update filter context - support multiselect by joining arrays
    filterContext.setSearchTerm(newFilters.q)
    filterContext.setVendorFilter(newFilters.vendor_name.length > 0 ? newFilters.vendor_name.join(',') : 'all')
    filterContext.setProgramFilter(newFilters.program_report.length > 0 ? newFilters.program_report.join(',') : 'all')
    filterContext.setCityFilter(newFilters.imp_ttp.length > 0 ? newFilters.imp_ttp.join(',') : 'all')
    filterContext.setNanoClusterFilter(newFilters.nano_cluster.length > 0 ? newFilters.nano_cluster.join(',') : 'all')
    filterContext.setRegionFilter(newFilters.region && newFilters.region.length > 0 ? newFilters.region.join(',') : 'all')
    filterContext.setYearFilter(newFilters.year && newFilters.year.length > 0 ? newFilters.year.join(',') : 'all')
    // ran_score filter removed - no longer used
    // loadData akan dipanggil otomatis oleh useEffect ketika currentFilter berubah
  }

  // Handler untuk reset filter
  const handleFilterReset = () => {
    console.log("Filters reset")
    // Set filter loading state untuk memberikan feedback visual
    setIsFilterLoading(true)
    filterContext.resetFilters()
    // loadData akan dipanggil otomatis oleh useEffect ketika currentFilter berubah
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white relative">
      {/* Loading Overlay dengan Blur Effect - hanya muncul saat filter loading (setelah initial load) */}
      {isFilterLoading && hasInitialLoad && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050B1B]/90 backdrop-blur-md transition-all duration-300 ease-in-out"
          aria-live="polite"
          aria-busy="true"
          role="status"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full border border-emerald-400/30" />
              <span className="absolute inline-flex h-[60px] w-[60px] rounded-full border border-white/10" />
              <span className="h-12 w-12 animate-spin rounded-full border-2 border-transparent border-l-emerald-300 border-t-cyan-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Loading map data...</p>
              <p className="mt-1 text-xs text-white/60">Applying filters</p>
            </div>
          </div>
        </div>
      )}

      <header className={`border-b border-white/10 bg-[#0B1533]/70 backdrop-blur transition-opacity duration-300 ${isFilterLoading ? 'opacity-40' : ''}`}>
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
              onClick={() => void loadData()}
              className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 transition hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto flex h-[calc(100vh-120px)] max-w-[1440px] flex-col gap-5 px-6 py-5 lg:h-[calc(100vh-140px)] transition-opacity duration-300 ${isFilterLoading ? 'opacity-30' : ''}`} style={{ pointerEvents: isFilterLoading ? 'none' : 'auto' }}>
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
              <p className="mt-1 text-2xl font-bold text-white">{totalSitesForSummary.toLocaleString('en-US')} Sites</p>
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
              <label
                htmlFor="toggle-excluded-markers"
                className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-white/70"
              >
                <input
                  id="toggle-excluded-markers"
                  type="checkbox"
                  checked={showExcluded}
                  onChange={(event) => setShowExcluded(event.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-white focus:ring-0"
                />
                <span>Show Hermes H1 markers</span>
              </label>
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
              <p className="mt-3 text-white/60">
                Grey markers highlight <span className="font-semibold text-white">Hermes H1 Project 5G : 1202 sites</span>. Use the toggle above to include or hide them on the map.
              </p>
              {invalidCoordinates > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-amber-300 font-medium">
                    âš ï¸ {invalidCoordinates} sites excluded from map due to invalid coordinates
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

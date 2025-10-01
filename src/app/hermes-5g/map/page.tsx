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
  SOW: 0
}

const DEFAULT_COLORS: Record<StatusLabel, string> = {
  ACTIVE: '#22C55E',  // Hijau untuk ACTIVE
  READY: '#2563EB',   // Biru untuk READY
  RFI: '#FACC15',     // Kuning untuk RFI
  SOW: '#EF4444'      // Merah untuk SOW
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
  const [colors, setColors] = useState<Record<StatusLabel, string>>(() => ({ ...DEFAULT_COLORS }))
  const [invalidCoordinates, setInvalidCoordinates] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  
  // Convert filter context to FilterValue format - support multiselect
  const currentFilter: FilterValue = useMemo(() => ({
    q: filterContext.searchTerm,
    vendor_name: filterContext.vendorFilter !== 'all' ? filterContext.vendorFilter.split(',').filter(Boolean) : [],
    program_report: filterContext.programFilter !== 'all' ? filterContext.programFilter.split(',').filter(Boolean) : [],
    imp_ttp: filterContext.cityFilter !== 'all' ? filterContext.cityFilter.split(',').filter(Boolean) : [],
    nano_cluster: filterContext.nanoClusterFilter !== 'all' ? filterContext.nanoClusterFilter.split(',').filter(Boolean) : []
  }), [filterContext.searchTerm, filterContext.vendorFilter, filterContext.programFilter, filterContext.cityFilter, filterContext.nanoClusterFilter])

  const totalSites = useMemo(() => points.length, [points])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
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
    } catch (err) {
      console.error('Failed to load Hermes 5G map data:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setPoints([])
      setCounts({ ...DEFAULT_COUNTS })
      setColors({ ...DEFAULT_COLORS })
      setInvalidCoordinates(0)
    } finally {
      setLoading(false)
    }
  }, [currentFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Effect untuk reload data saat filter berubah
  useEffect(() => {
    void loadData()
  }, [currentFilter])

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
    // Update filter context - support multiselect by joining arrays
    filterContext.setSearchTerm(newFilters.q)
    filterContext.setVendorFilter(newFilters.vendor_name.length > 0 ? newFilters.vendor_name.join(',') : 'all')
    filterContext.setProgramFilter(newFilters.program_report.length > 0 ? newFilters.program_report.join(',') : 'all')
    filterContext.setCityFilter(newFilters.imp_ttp.length > 0 ? newFilters.imp_ttp.join(',') : 'all')
    filterContext.setNanoClusterFilter(newFilters.nano_cluster.length > 0 ? newFilters.nano_cluster.join(',') : 'all')
  }

  // Handler untuk reset filter
  const handleFilterReset = () => {
    console.log("Filters reset")
    filterContext.resetFilters()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white">
      <header className="border-b border-white/10 bg-[#0B1533]/70 backdrop-blur">
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
            <img src="/logo indosat putih.png" alt="Indosat Ooredoo" className="h-9" />
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

      <main className="mx-auto flex h-[calc(100vh-120px)] max-w-[1440px] flex-col gap-5 px-6 py-5 lg:h-[calc(100vh-140px)]">
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
            <Hermes5GMap points={points} colors={colors} loading={loading} error={error} />
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0B1533]/60 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Status Summary</h2>
              <p className="mt-1 text-2xl font-bold text-white">{totalSites.toLocaleString('en-US')} Sites</p>
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
            </div>

            <div className="space-y-3 text-sm">
              {STATUS_ORDER.map((status) => {
                const color = colors[status] ?? '#94A3B8'
                const value = counts[status] ?? 0
                const percentage = totalSites > 0 ? Math.round((value / totalSites) * 100) : 0

                return (
                  <div key={status} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium tracking-[0.24em] text-white/70">{status}</span>
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



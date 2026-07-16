"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronDown, FolderOpen, Pencil, RefreshCw, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
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
import { FilterBar, FilterValue } from '@/components/filters/FilterBar'
import { useAopTemplates } from '@/hooks/useAopTemplates'
import { useDebounce } from '@/hooks/useDebounce'
import type { AopDashboardConfig } from '@/config/aop-dashboards'
import {
  getAopFiltersEndpoint,
  getAopMapDataEndpoint,
  getAopTemplatesEndpoint,
} from '@/config/aop-dashboards'

// Compact point format from API
interface CompactMapPoint {
  i: string   // id
  s: number   // status (0=SOW, 1=RFI, 2=INSTALL, 3=ON_AIR)
  a: number   // lat
  o: number   // long
  v?: string  // vendorName
  n?: string  // siteName
  d?: string  // siteId
  p?: string  // programReport
  t?: string  // impTtp
  c?: string  // nanoCluster
}

const NUM_TO_STATUS: StatusLabel[] = ['SOW', 'RFI', 'CRFI', 'MOS', 'ON_AIR']

// Convert compact point to full point
function expandPoint(cp: CompactMapPoint): HermesMapPoint {
  return {
    id: cp.i,
    status: NUM_TO_STATUS[cp.s] || 'SOW',
    lat: cp.a,
    long: cp.o,
    vendorName: cp.v || null,
    siteName: cp.n || null,
    siteId: cp.d || null,
    programReport: cp.p || null,
    impTtp: cp.t || null,
    nanoCluster: cp.c || null
  }
}

interface MapApiSuccess {
  status: 'success'
  data: {
    points: HermesMapPoint[] | CompactMapPoint[]
    counts: Record<StatusLabel, number>
    total: number
    colors: Record<StatusLabel, string>
    invalidCoordinates: number
    compact?: boolean
  }
  timestamp: string
}

interface MapApiError {
  status: 'error'
  message: string
  error?: string
}

type MapApiResponse = MapApiSuccess | MapApiError

const STATUS_ORDER: StatusLabel[] = ['ON_AIR', 'MOS', 'CRFI', 'RFI', 'SOW']

const DEFAULT_COUNTS: Record<StatusLabel, number> = {
  ON_AIR: 0,
  MOS: 0,
  CRFI: 0,
  RFI: 0,
  SOW: 0,
  ACTIVE: 0,  // Keep for backward compatibility
  READY: 0,   // Keep for backward compatibility
  INSTALL: 0  // Keep for backward compatibility
}

const DEFAULT_COLORS: Record<StatusLabel, string> = {
  ON_AIR: '#22C55E',   // Green
  MOS: '#8B5CF6',      // Purple/Violet (more distinct from green)
  CRFI: '#3B82F6',     // Blue
  RFI: '#FACC15',      // Yellow
  SOW: '#F97316',      // Orange
  ACTIVE: '#22C55E',   // Keep for backward compatibility
  READY: '#38BDF8',    // Keep for backward compatibility
  INSTALL: '#38BDF8'   // Keep for backward compatibility
}

// Status label display mapping
const STATUS_DISPLAY_LABELS: Record<StatusLabel, string> = {
  ON_AIR: 'On-Air',
  MOS: 'MOS',
  CRFI: 'CRFI',
  RFI: 'RFI',
  SOW: 'SOW',
  ACTIVE: 'On-Air',  // Map ACTIVE to On-Air for display
  READY: 'Install',  // Map READY to Install for display
  INSTALL: 'Install' // Keep for backward compatibility
}

const INITIAL_FILTER: FilterValue = {
  q: '',
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  circle: [],
  site_category: [],
  ran_score: [],
  pm_indosat: [],  // Project (pm_indosat)
  year: [],
  priority_congest_urgent: [],
  trial_gb_factory: []
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return 'Not available'
  }

  try {
    const date = new Date(timestamp)
    return date.toLocaleString('id-ID', {
      dateStyle: 'full',
      timeStyle: 'short'
    })
  } catch (error) {
    console.warn('Failed to format timestamp:', error)
    return timestamp
  }
}

export function AopDashboardMapPage({ config }: { config: AopDashboardConfig }) {
  const mapDataEndpoint = getAopMapDataEndpoint(config)
  const filtersEndpoint = getAopFiltersEndpoint(config)
  const templatesEndpoint = getAopTemplatesEndpoint(config)

  const [filterValue, setFilterValue] = useState<FilterValue>(INITIAL_FILTER)
  const [points, setPoints] = useState<HermesMapPoint[]>([])
  const [counts, setCounts] = useState<Record<StatusLabel, number>>(() => ({ ...DEFAULT_COUNTS }))
  const [totalCounts, setTotalCounts] = useState<Record<StatusLabel, number>>(() => ({ ...DEFAULT_COUNTS }))
  const [colors, setColors] = useState<Record<StatusLabel, string>>(() => ({ ...DEFAULT_COLORS }))
  const [invalidCoordinates, setInvalidCoordinates] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFilterLoading, setIsFilterLoading] = useState(false) // State khusus untuk filter loading
  const [hasInitialLoad, setHasInitialLoad] = useState(false) // Track initial load completion
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(true)

  const {
    templates,
    templatesLoading,
    selectedTemplateId,
    selectedTemplateName,
    loadTemplateOpen,
    setLoadTemplateOpen,
    createTemplateMode,
    setCreateTemplateMode,
    fetchTemplates,
    handleLoadTemplate,
    openSaveTemplateModal,
    exitCreateTemplateMode,
    handleSaveTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    templateModalOpen,
    setTemplateModalOpen,
    templateName,
    setTemplateName,
    templateSaveError,
    templateUpdateError,
    templateDeleteError,
    deleteConfirmTemplate,
    setDeleteConfirmTemplate,
    templateUpdating,
    setTemplateUpdateError,
    setTemplateDeleteError,
    setTemplateSaveError,
  } = useAopTemplates({
    filterValue,
    setFilterValue,
    initialFilter: INITIAL_FILTER,
    templatesEndpoint,
  })

  // Debounce filter untuk unified debouncing (300ms seperti Hermes 5G)
  const debouncedFilterValue = useDebounce(filterValue, 300)

  const visiblePoints = useMemo(
    () => (showExcluded ? points : points.filter(point => !point.isExcluded)),
    [points, showExcluded]
  )

  const totalSitesForSummary = useMemo(() => {
    return Object.values(totalCounts).reduce((sum, count) => sum + count, 0)
  }, [totalCounts])

  const selectTemplateButtonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  useEffect(() => {
    if (!loadTemplateOpen) {
      setDropdownPosition(null)
      return
    }
    const t = setTimeout(() => {
      const btn = selectTemplateButtonRef.current
      if (btn) {
        const rect = btn.getBoundingClientRect()
        setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) })
      }
    }, 50)
    return () => clearTimeout(t)
  }, [loadTemplateOpen])

  // Handler untuk status click
  const handleStatusClick = useCallback((status: StatusLabel) => {
    const currentStatuses = filterValue.status || []
    const isSelected = currentStatuses.includes(status)
    
    if (isSelected) {
      // Remove status dari filter
      const newStatuses = currentStatuses.filter(s => s !== status)
      setFilterValue(prev => ({ ...prev, status: newStatuses }))
    } else {
      // Add status ke filter
      const newStatuses = [...currentStatuses, status]
      setFilterValue(prev => ({ ...prev, status: newStatuses }))
    }
  }, [filterValue.status])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setIsFilterLoading(true) // Set filter loading state
      setError(null)

      // Build URL with current filter
      const params = new URLSearchParams()
      if (debouncedFilterValue.q) {
        params.set('q', debouncedFilterValue.q)
      }
      debouncedFilterValue.vendor_name.forEach((value) => {
        params.append('vendor_name', value)
      })
      debouncedFilterValue.program_report.forEach((value) => {
        params.append('program_report', value)
      })
      debouncedFilterValue.circle?.forEach((value) => {
        params.append('region_circle', value)
      })
      debouncedFilterValue.site_category?.forEach((value) => {
        params.append('site_category', value)
      })
      debouncedFilterValue.ran_score?.forEach((value) => {
        params.append('ran_score', value)
      })
      debouncedFilterValue.pm_indosat?.forEach((value) => {
        params.append('pm_indosat', value)
      })
      debouncedFilterValue.year?.forEach((value) => {
        params.append('year', value)
      })
      debouncedFilterValue.priority_congest_urgent?.forEach((value) => {
        params.append('priority_congest_urgent', value)
      })
      debouncedFilterValue.status.forEach((value) => {
        params.append('status', value)
      })

      const url = `${mapDataEndpoint}?${params.toString()}`
      console.log(`Loading ${config.label} map data with filter:`, debouncedFilterValue)
      console.log('Map API URL:', url)

      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload: MapApiResponse = await response.json()

      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to load map data')
      }

      // Handle compact format
      const expandedPoints = payload.data.compact 
        ? (payload.data.points as CompactMapPoint[]).map(expandPoint)
        : payload.data.points as HermesMapPoint[]
      
      setPoints(expandedPoints)
      setCounts(payload.data.counts as Record<StatusLabel, number>)
      setColors(payload.data.colors as Record<StatusLabel, string>)
      setInvalidCoordinates(payload.data.invalidCoordinates || 0)
      setLastUpdated(payload.timestamp)
      setHasInitialLoad(true) // Mark initial load as complete

      // Load total counts for status summary (without status filter)
      if (debouncedFilterValue.status.length > 0) {
        try {
          const totalParams = new URLSearchParams()
          if (debouncedFilterValue.q) {
            totalParams.set('q', debouncedFilterValue.q)
          }
          debouncedFilterValue.vendor_name.forEach((value) => {
            totalParams.append('vendor_name', value)
          })
          debouncedFilterValue.program_report.forEach((value) => {
            totalParams.append('program_report', value)
          })
          debouncedFilterValue.circle?.forEach((value) => {
            totalParams.append('region_circle', value)
          })
          debouncedFilterValue.site_category?.forEach((value) => {
            totalParams.append('site_category', value)
          })
          debouncedFilterValue.ran_score?.forEach((value) => {
            totalParams.append('ran_score', value)
          })
          debouncedFilterValue.pm_indosat?.forEach((value) => {
            totalParams.append('pm_indosat', value)
          })
          debouncedFilterValue.year?.forEach((value) => {
            totalParams.append('year', value)
          })
          debouncedFilterValue.priority_congest_urgent?.forEach((value) => {
            totalParams.append('priority_congest_urgent', value)
          })
          // Don't include status filter for total counts

          const totalUrl = `${mapDataEndpoint}?${totalParams.toString()}`
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
      console.error(`Failed to load ${config.label} map data:`, err)
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
  }, [debouncedFilterValue, mapDataEndpoint, config.label])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const headerTitle = config.mapTitle

  // Handler untuk perubahan filter
  const handleFilterChange = (newFilters: FilterValue) => {
    console.log("Filter changed:", newFilters)
    // Set filter loading state immediately untuk memberikan feedback visual yang cepat
    setIsFilterLoading(true)
    setFilterValue(newFilters)
  }

  // Handler untuk reset filter
  const handleFilterReset = () => {
    console.log("Filters reset")
    // Set filter loading state untuk memberikan feedback visual
    setIsFilterLoading(true)
    setFilterValue(INITIAL_FILTER)
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
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/60">{config.label} Dashboard</span>
              <h1 className="text-xl font-semibold tracking-wide text-white">{headerTitle}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-2 text-xs uppercase tracking-[0.32em] text-white/60 lg:justify-center">
            <Link
              href={config.basePath}
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
        {/* Filter Bar + Templates */}
        <div className="relative z-10 overflow-visible rounded-2xl border border-white/10 bg-[#0B1533]/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px]">
              <button
                ref={selectTemplateButtonRef}
                type="button"
                onClick={() => {
                  setLoadTemplateOpen((o) => !o)
                  if (!loadTemplateOpen && templates.length === 0) void fetchTemplates("dropdown_open")
                }}
                className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200"
                aria-expanded={loadTemplateOpen}
                aria-haspopup="listbox"
                aria-label="Select template"
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{selectedTemplateName ?? "Select template"}</span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 transition ${loadTemplateOpen ? "rotate-180" : ""}`} />
              </button>
              {loadTemplateOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9998] bg-transparent"
                      aria-hidden
                      onClick={() => setLoadTemplateOpen(false)}
                    />
                    {dropdownPosition != null && (
                      <div
                        className="fixed z-[9999] max-h-[min(12rem,60vh)] overflow-y-auto rounded-lg border border-white/10 bg-[#0F1630] py-1 shadow-xl"
                        role="listbox"
                        style={{
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          width: dropdownPosition.width,
                          minWidth: 200,
                        }}
                      >
                        {templatesLoading ? (
                          <div className="px-3 py-2 text-xs text-white/50">Loading...</div>
                        ) : (
                          <>
                            <button
                              type="button"
                              role="option"
                              onClick={() => handleLoadTemplate(null)}
                              className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10"
                            >
                              All data
                            </button>
                            {templates.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-white/50">No templates saved yet.</div>
                            ) : (
                              templates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  role="option"
                                  onClick={() => handleLoadTemplate({ id: t.id, payload: t.payload })}
                                  className="w-full px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10"
                                >
                                  {t.name}
                                </button>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>,
                  document.body
                )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!createTemplateMode) {
                  setTemplateUpdateError(null)
                  setTemplateDeleteError(null)
                }
                setCreateTemplateMode((prev) => !prev)
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                createTemplateMode
                  ? "border-amber-500/60 bg-amber-500/20 text-amber-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
              title={createTemplateMode ? "Close filter panel" : "Edit filter criteria"}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Edit filters
            </button>
          </div>

          {createTemplateMode && (
            <>
              <FilterBar
                value={filterValue}
                onChange={handleFilterChange}
                onReset={handleFilterReset}
                variant={config.filterVariant}
                endpoint={filtersEndpoint}
              />

              <div className="flex-shrink-0 border-t border-white/5 pt-3">
                {(templateUpdateError ?? templateDeleteError) && (
                  <p className="mb-2 text-xs text-red-400">{templateUpdateError ?? templateDeleteError}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedTemplateName ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleUpdateTemplate()}
                        disabled={templateUpdating}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Update this template with current filters"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {templateUpdating ? "Updating..." : "Update template"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const t = selectedTemplateId ? templates.find((x) => x.id === selectedTemplateId) : undefined
                          if (t) setDeleteConfirmTemplate({ id: t.id, name: t.name })
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-200"
                        title="Delete this template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete template
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={openSaveTemplateModal}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200"
                      title="Save current filters as template"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save as template
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      exitCreateTemplateMode()
                      setTemplateUpdateError(null)
                      setTemplateDeleteError(null)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
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
            </div>

            <div className="space-y-3 text-sm">
              {STATUS_ORDER.map((status) => {
                const color = colors[status] ?? '#94A3B8'
                const value = totalCounts[status] ?? 0
                const percentage = totalSitesForSummary > 0 ? Math.round((value / totalSitesForSummary) * 100) : 0
                const isSelected = (filterValue.status || []).includes(status)
                const displayLabel = STATUS_DISPLAY_LABELS[status] || status

                return (
                  <div 
                    key={status} 
                    className={`flex items-center justify-between gap-3 rounded-lg p-2 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                      isSelected ? 'bg-white/10 ring-1 ring-white/20' : ''
                    }`}
                    onClick={() => handleStatusClick(status)}
                    title={`Click to ${isSelected ? 'remove' : 'add'} ${displayLabel} filter`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className={`text-xs font-medium tracking-[0.24em] ${
                        isSelected ? 'text-white' : 'text-white/70'
                      }`}>{displayLabel}</span>
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
                <li><span className="font-semibold text-white">On-Air</span> - Site is fully activated (rfs_af).</li>
                <li><span className="font-semibold text-white">MOS</span> - MOS milestone achieved (mos_af).</li>
                <li><span className="font-semibold text-white">CRFI</span> - RFI accepted (rfi_accepted).</li>
                <li><span className="font-semibold text-white">RFI</span> - RFI received (ic_000010_af).</li>
                <li><span className="font-semibold text-white">SOW</span> - Total registered scope of work (system_key).</li>
              </ul>
              {invalidCoordinates > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-amber-300 font-medium">
                    ⚠️ {invalidCoordinates} sites excluded from map due to invalid coordinates
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

      {/* Delete template confirmation modal */}
      {deleteConfirmTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="aop-map-delete-template-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0F1630] p-4 shadow-xl">
            <h2 id="aop-map-delete-template-title" className="mb-3 text-sm font-semibold text-white">
              Delete template
            </h2>
            <p className="mb-4 text-xs text-white/70">
              Delete template &quot;{deleteConfirmTemplate.name}&quot;? This cannot be undone.
            </p>
            {templateDeleteError && (
              <p className="mb-2 text-xs text-red-400">{templateDeleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmTemplate(null)
                  setTemplateDeleteError(null)
                }}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteTemplate()}
                className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save template modal */}
      {templateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="aop-map-save-template-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0F1630] p-4 shadow-xl">
            <h2 id="aop-map-save-template-title" className="mb-3 text-sm font-semibold text-white">
              Save filter template
            </h2>
            <div className="mb-4">
              <label htmlFor="aop-map-template-name" className="mb-1 block text-xs text-white/60">
                Template name
              </label>
              <input
                id="aop-map-template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Region Jakarta"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
            {templateSaveError && (
              <p className="mb-2 text-xs text-red-400">{templateSaveError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTemplateModalOpen(false)
                  setTemplateSaveError(null)
                }}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

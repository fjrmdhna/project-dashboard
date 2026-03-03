"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Download, RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import { useApiCache } from "@/hooks/useApiCache"

const Hermes5GMap = dynamic(
  () => import("@/components/maps/Hermes5GMap").then((mod) => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/60">Loading map...</p>
        </div>
      </div>
    ),
  }
)

import type { HermesMapPoint, StatusLabel } from "@/components/maps/Hermes5GMap"
import { useFilter } from "@/contexts/FilterContext"
import { FilterBar, FilterValue } from "@/components/filters/FilterBar"
import { getProgramReportsForDisplayName } from "@/lib/hermes-program-mapping"
import { normalizeRanScoreForHermesFilter } from "@/lib/hermes-5g-utils"

interface InvalidCoordinateRow {
  id: string
  status: string
  vendorName?: string | null
  programReport?: string | null
  impTtp?: string | null
  nanoCluster?: string | null
  region?: string | null
  region_circle?: string | null
  year?: string | null
  ran_score?: string | null
  lat?: string | number | null
  long?: string | number | null
}

interface MapApiSuccess {
  status: "success"
  data: {
    points: HermesMapPoint[]
    counts: Record<StatusLabel, number>
    total: number
    colors: Record<StatusLabel, string>
    invalidCoordinates: number
    invalidCoordinateRows?: InvalidCoordinateRow[]
  }
  timestamp: string
}

interface MapApiError {
  status: "error"
  message: string
  error?: string
}

type MapApiResponse = MapApiSuccess | MapApiError

const STATUS_ORDER: StatusLabel[] = ["ACTIVE", "READY", "RFI", "SOW"]

const DEFAULT_COUNTS: Record<StatusLabel, number> = {
  ACTIVE: 0,
  READY: 0,
  RFI: 0,
  CRFI: 0,
  MOS: 0,
  SOW: 0,
  INSTALL: 0,
  ON_AIR: 0,
}

const DEFAULT_COLORS: Record<StatusLabel, string> = {
  ACTIVE: "#22C55E",
  READY: "#2563EB",
  RFI: "#FACC15",
  CRFI: "#3B82F6",
  MOS: "#8B5CF6",
  SOW: "#EF4444",
  INSTALL: "#8B5CF6",
  ON_AIR: "#06B6D4",
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "Not available"
  try {
    return new Date(timestamp).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })
  } catch {
    return timestamp
  }
}

export default function CommercialATPMapPage() {
  const filterContext = useFilter()

  const fetchMapAll = useCallback(async () => {
    const res = await fetch("/api/hermes-5g/map-data", { cache: "no-store" })
    const json: MapApiResponse = await res.json()
    if (json.status !== "success") {
      throw new Error((json as MapApiError).message || "Failed to load map data")
    }
    return json as MapApiSuccess
  }, [])

  const { data: cachedMapResponse, loading, error, refetch } = useApiCache<MapApiSuccess>(
    "commercial-atp-map-all-v2",
    fetchMapAll,
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 15 * 60 * 1000,
      refetchOnMount: false,
      validateFn: (d) => {
        const res = d as MapApiSuccess
        return (
          !!res?.status &&
          res.status === "success" &&
          Array.isArray(res.data?.points) &&
          res.data?.colors != null &&
          typeof res.data?.invalidCoordinates === "number"
        )
      },
    }
  )

  const hasInitialLoad = !!cachedMapResponse
  const lastUpdated = cachedMapResponse?.timestamp ?? null
  const colors = useMemo(
    () => cachedMapResponse?.data?.colors ?? DEFAULT_COLORS,
    [cachedMapResponse?.data?.colors]
  )

  const currentFilter: FilterValue = useMemo(() => {
    const debounced = filterContext.debouncedFilters || filterContext
    const circleValue = debounced.regionFilter !== "all" ? debounced.regionFilter.split(",").filter(Boolean) : []
    return {
      q: debounced.searchTerm,
      vendor_name: debounced.vendorFilter !== "all" ? debounced.vendorFilter.split(",").filter(Boolean) : [],
      program_report: debounced.programFilter !== "all" ? debounced.programFilter.split(",").filter(Boolean) : [],
      imp_ttp: debounced.cityFilter !== "all" ? debounced.cityFilter.split(",").filter(Boolean) : [],
      nano_cluster: debounced.nanoClusterFilter !== "all" ? debounced.nanoClusterFilter.split(",").filter(Boolean) : [],
      region: [],
      year: debounced.yearFilter !== "all" ? debounced.yearFilter.split(",").filter(Boolean) : [],
      circle: circleValue,
      ran_score: debounced.ranScoreFilter !== "all" ? debounced.ranScoreFilter.split(",").filter(Boolean) : [],
      status: debounced.statusFilters || [],
    }
  }, [filterContext.debouncedFilters])

  const { points, totalCounts, invalidCoordinatesFiltered, filteredInvalidRows } = useMemo(() => {
    const raw = cachedMapResponse?.data
    const invalidRows = raw?.invalidCoordinateRows ?? []
    const emptyResult = {
      points: [] as HermesMapPoint[],
      counts: { ...DEFAULT_COUNTS },
      totalCounts: { ...DEFAULT_COUNTS },
      invalidCoordinatesFiltered: invalidRows.length,
      filteredInvalidRows: [] as InvalidCoordinateRow[],
    }
    if (!raw?.points?.length && !invalidRows.length) return emptyResult

    const q = (currentFilter.q ?? "").toLowerCase().trim()
    const vendorSet = currentFilter.vendor_name?.length ? new Set(currentFilter.vendor_name) : null
    const impTtpSet = currentFilter.imp_ttp?.length ? new Set(currentFilter.imp_ttp) : null
    const nanoSet = currentFilter.nano_cluster?.length ? new Set(currentFilter.nano_cluster) : null
    const regionSet = currentFilter.region?.length ? new Set(currentFilter.region) : null
    const yearSet = currentFilter.year?.length ? new Set(currentFilter.year) : null
    const statusSet = currentFilter.status?.length ? new Set(currentFilter.status) : null

    const allProgramReports = [
      ...new Set([
        ...(raw?.points ?? []).map((p: HermesMapPoint) => p.programReport),
        ...invalidRows.map((r: InvalidCoordinateRow) => r.programReport),
      ].filter(Boolean)),
    ] as string[]
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

    const normalizeCircle = (v: string) => v.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    const circleSet = currentFilter.circle?.length ? new Set(currentFilter.circle.map(normalizeCircle)) : null
    const ranScoreSet = currentFilter.ran_score?.length ? new Set(currentFilter.ran_score) : null

    type FilterableRow = {
      id: string
      status: string
      vendorName?: string | null
      programReport?: string | null
      impTtp?: string | null
      nanoCluster?: string | null
      region?: string | null
      region_circle?: string | null
      year?: string | null
      ran_score?: string | null
    }
    const matchesFilter = (p: FilterableRow, includeStatus = true) => {
      if (vendorSet && !vendorSet.has(p.vendorName ?? "")) return false
      if (programSet && !programSet.has(p.programReport ?? "")) return false
      if (impTtpSet && !impTtpSet.has(p.impTtp ?? "")) return false
      if (nanoSet && !nanoSet.has(p.nanoCluster ?? "")) return false
      if (regionSet && !regionSet.has(p.region ?? "")) return false
      if (yearSet && !yearSet.has(p.year ?? "")) return false
      if (circleSet) {
        const pCircle = normalizeCircle(p.region_circle ?? "")
        if (!pCircle || !circleSet.has(pCircle)) return false
      }
      if (ranScoreSet && !ranScoreSet.has(normalizeRanScoreForHermesFilter(p.ran_score))) return false
      if (includeStatus && statusSet && !statusSet.has(p.status)) return false
      if (q) {
        const searchable = [p.id, p.vendorName, p.programReport].filter(Boolean).join(" ").toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    }

    const filtered = (raw?.points ?? []).filter((p: HermesMapPoint) => matchesFilter(p))
    const filteredInvalid = invalidRows.filter((r: InvalidCoordinateRow) => matchesFilter(r))
    const countsByStatus: Record<string, number> = { ...DEFAULT_COUNTS }
    filtered.forEach((p: HermesMapPoint) => {
      countsByStatus[p.status] = (countsByStatus[p.status] ?? 0) + 1
    })
    const totalFiltered =
      !statusSet || statusSet.size === 0
        ? filtered
        : (raw?.points ?? []).filter((p: HermesMapPoint) => matchesFilter(p, false))
    const totalCountsByStatus: Record<string, number> = { ...DEFAULT_COUNTS }
    totalFiltered.forEach((p: HermesMapPoint) => {
      totalCountsByStatus[p.status] = (totalCountsByStatus[p.status] ?? 0) + 1
    })

    return {
      points: filtered as HermesMapPoint[],
      counts: countsByStatus as Record<StatusLabel, number>,
      totalCounts: totalCountsByStatus as Record<StatusLabel, number>,
      invalidCoordinatesFiltered: filteredInvalid.length,
      filteredInvalidRows: filteredInvalid,
    }
  }, [cachedMapResponse, currentFilter])

  const invalidCoordinates = cachedMapResponse?.data?.invalidCoordinateRows
    ? invalidCoordinatesFiltered
    : (cachedMapResponse?.data?.invalidCoordinates ?? 0)

  const visiblePoints = useMemo(() => points, [points])
  const totalSitesForSummary = useMemo(
    () => Object.values(totalCounts).reduce((sum, count) => sum + count, 0),
    [totalCounts]
  )

  const handleStatusClick = useCallback(
    (status: StatusLabel) => {
      const currentStatuses = filterContext.statusFilters || []
      const isSelected = currentStatuses.includes(status)
      filterContext.setStatusFilters(
        isSelected ? currentStatuses.filter((s) => s !== status) : [...currentStatuses, status]
      )
    },
    [filterContext]
  )

  const [isExportingInvalid, setIsExportingInvalid] = useState(false)
  const handleExportInvalidCoordinates = useCallback(async () => {
    if (!filteredInvalidRows?.length || isExportingInvalid) return
    setIsExportingInvalid(true)
    try {
      const XLSX = await import("xlsx")
      const formatCoord = (v: string | number | null | undefined): string =>
        v === null || v === undefined ? "" : String(v)
      const sheetData = filteredInvalidRows.map((row) => ({
        "System Key": row.id,
        Status: row.status,
        Vendor: row.vendorName ?? "",
        "Program Report": row.programReport ?? "",
        City: row.impTtp ?? "",
        Cluster: row.nanoCluster ?? "",
        Region: row.region ?? "",
        Circle: row.region_circle ?? "",
        Year: row.year ?? "",
        "RAN Score": row.ran_score ?? "",
        Lat: formatCoord(row.lat),
        Long: formatCoord(row.long),
        Note: "Invalid coordinates",
      }))
      const worksheet = XLSX.utils.json_to_sheet(sheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invalid coordinates")
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")
      const filename = `commercial-atp-invalid-coordinates-${timestamp}.xlsx`
      XLSX.writeFile(workbook, filename)
    } catch (err) {
      console.error("Export invalid coordinates failed:", err)
    } finally {
      setIsExportingInvalid(false)
    }
  }, [filteredInvalidRows, isExportingInvalid])

  const headerTitle = "Commercial ATP Progress Map"

  if (!filterContext.isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#070F2B] via-[#050B1B] to-[#050B1B] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/60">Loading map...</p>
        </div>
      </div>
    )
  }

  const handleFilterChange = (newFilters: FilterValue) => {
    filterContext.setSearchTerm(newFilters.q ?? "")
    filterContext.setVendorFilter(newFilters.vendor_name?.length ? newFilters.vendor_name.join(",") : "all")
    filterContext.setProgramFilter(newFilters.program_report?.length ? newFilters.program_report.join(",") : "all")
    filterContext.setCityFilter(newFilters.imp_ttp?.length ? newFilters.imp_ttp.join(",") : "all")
    filterContext.setNanoClusterFilter(newFilters.nano_cluster?.length ? newFilters.nano_cluster.join(",") : "all")
    filterContext.setRegionFilter(newFilters.circle?.length ? newFilters.circle.join(",") : "all")
    filterContext.setYearFilter(newFilters.year?.length ? newFilters.year.join(",") : "all")
    filterContext.setRanScoreFilter(newFilters.ran_score?.length ? newFilters.ran_score.join(",") : "all")
  }

  const handleFilterReset = () => filterContext.resetFilters()

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
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src="/logo-indosat-putih.png" alt="Indosat Ooredoo" className="h-9" />
            <div className="hidden flex-col lg:flex">
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/60">
                Commercial ATP Dashboard
              </span>
              <h1 className="text-xl font-semibold tracking-wide text-white">{headerTitle}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-2 text-xs uppercase tracking-[0.32em] text-white/60 lg:justify-center">
            <Link
              href="/commercial-atp"
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
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-120px)] max-w-[1440px] flex-col gap-5 px-6 py-5 lg:h-[calc(100vh-140px)] transition-opacity duration-300">
        <div className="rounded-2xl border border-white/10 bg-[#0B1533]/60 px-4 py-3">
          <FilterBar
            value={currentFilter}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            variant="default"
            singleRow
            endpoint="/api/filters"
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
                    {totalSitesForSummary.toLocaleString("en-US")} Sites
                  </p>
                  {invalidCoordinates > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg
                            className="h-4 w-4 shrink-0 text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-amber-200">
                            {invalidCoordinates} sites with invalid coordinates
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportInvalidCoordinates}
                          disabled={isExportingInvalid}
                          className="shrink-0 rounded p-1.5 text-amber-200 transition hover:bg-amber-500/20 hover:text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isExportingInvalid ? "Exporting..." : "Export to Excel"}
                          aria-label={isExportingInvalid ? "Exporting..." : "Export invalid coordinates to Excel"}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 text-sm">
              {STATUS_ORDER.map((status) => {
                const color = colors[status] ?? "#94A3B8"
                const value = totalCounts[status] ?? 0
                const percentage = totalSitesForSummary > 0 ? Math.round((value / totalSitesForSummary) * 100) : 0
                const isSelected = (filterContext.statusFilters || []).includes(status)
                return (
                  <div
                    key={status}
                    className={`flex items-center justify-between gap-3 rounded-lg p-2 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                      isSelected ? "bg-white/10 ring-1 ring-white/20" : ""
                    }`}
                    onClick={() => handleStatusClick(status)}
                    title={`Click to ${isSelected ? "remove" : "add"} ${status} filter`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span
                        className={`text-xs font-medium tracking-[0.24em] ${isSelected ? "text-white" : "text-white/70"}`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 font-semibold">
                      <span className="text-base text-white">{value.toLocaleString("en-US")}</span>
                      <span className="text-[11px] text-white/50">{percentage}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[11px] leading-relaxed text-white/70">
              <p className="font-semibold uppercase tracking-[0.26em] text-white/80">Status Legend</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="font-semibold text-white">ACTIVE</span> - Site is fully activated.
                </li>
                <li>
                  <span className="font-semibold text-white">READY</span> - Site has completed readiness tasks.
                </li>
                <li>
                  <span className="font-semibold text-white">RFI</span> - CAF acceptance received.
                </li>
                <li>
                  <span className="font-semibold text-white">SOW</span> - Total registered scope of work.
                </li>
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

"use client"

import Link from "next/link"
import { useMemo, useState, useEffect, useTransition, useDeferredValue, useCallback, type ReactNode, type CSSProperties } from "react"
import { ChevronDown, Download, Save, FolderOpen, SlidersHorizontal, Pencil, Trash2 } from "lucide-react"

import { FilterBar, prefetchFilterOptions, type FilterValue } from "@/components/filters/FilterBar"
import { useDebounce } from "@/hooks/useDebounce"
import { MatrixStatsCard, type Row as MatrixRow } from "@/components/cards/MatrixStatsCard"
import { FiveGReadinessCard } from "@/components/cards/FiveGReadinessCard"
import { FiveGActivatedCard } from "@/components/cards/FiveGActivatedCard"
import ProgressCurveLineChart from "@/components/charts/ProgressCurveLineChart"
import { DailyRunrateCard } from "@/components/cards/DailyRunrateCard"
import { TopIssueCard } from "@/components/cards/TopIssueCard"
import { GapStatusCard } from "@/components/cards/GapStatusCard"
import { AgingPoCard } from "@/components/cards/AgingPoCard"
import { CircleAchievementCard } from "@/components/cards/CircleAchievementCard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { useAopData } from "@/hooks/useAopData"

const AopLoadingScreen = ({ message }: { message: string }) => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#030a1f] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050B1B]/70 via-transparent to-[#050B1B]" />
    </div>

    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.65em] text-white/60">AOP Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-wide">Preparing Dashboard</h1>
        <p className="text-sm text-white/70">{message}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full border border-emerald-400/30" />
          <span className="absolute inline-flex h-[88px] w-[88px] rounded-full border border-white/10" />
          <span className="h-16 w-16 animate-spin rounded-full border-2 border-transparent border-l-emerald-300 border-t-cyan-300" />
        </div>
        <div className="w-52">
          <div className="hermes-loading-pill h-2 w-full rounded-full bg-white/20" />
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-white/60">Data Synchronization</p>
        </div>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Matrix Statistics", "Activation Progress", "Vendor Performance"].map((label) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{label}</p>
            <div className="mt-4 space-y-3">
              <div className="hermes-loading-pill h-8 w-full rounded-xl bg-white/10" />
              <div className="hermes-loading-pill h-2 w-3/4 rounded-full bg-white/10" />
              <div className="flex items-center gap-3 text-[11px] text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300/80" />
                <span>Retrieving latest metrics...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

type DashboardRow = MatrixRow & {
  nano_cluster?: string | null
  region_circle?: string | null
  mocn_activation_forecast?: string | null
}

const DASHBOARD_ROWS: DashboardRow[] = [
  {
    system_key: "AOP-001",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Jakarta",
    nano_cluster: "Ops Cluster Alpha",
    caf_approved: "2025-02-02",
    mos_af: "2025-02-10",
    ic_000040_af: "2025-02-18",
    imp_integ_af: "2025-02-24",
    rfs_forecast_lock: "2025-03-05",
    rfs_af: "2025-03-04",
    mocn_activation_forecast: "2025-02-22",
    endorse_af: "2025-03-09",
    lat: -6.2,
    long: 106.8
  },
  {
    system_key: "AOP-002",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Yogyakarta",
    nano_cluster: "Ops Cluster Beta",
    caf_approved: "2025-02-05",
    mos_af: "2025-02-13",
    ic_000040_af: "2025-02-22",
    imp_integ_af: "2025-03-03",
    rfs_forecast_lock: "2025-03-18",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-01",
    hotnews_af: "2025-03-06",
    lat: -7.8,
    long: 110.4
  },
  {
    system_key: "AOP-003",
    vendor_name: "Ericsson Indonesia",
    program_report: "AOP Alignment Wave 1",
    imp_ttp: "Bandung",
    nano_cluster: "Ops Cluster Gamma",
    caf_approved: "2025-02-08",
    mos_af: "2025-02-16",
    ic_000040_af: "2025-02-24",
    imp_integ_af: "2025-03-05",
    rfs_forecast_lock: "2025-03-20",
    rfs_af: "2025-03-18",
    mocn_activation_forecast: "2025-03-02",
    endorse_af: "2025-03-22",
    lat: -6.9,
    long: 107.6
  },
  {
    system_key: "AOP-004",
    vendor_name: "ZTE Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Medan",
    nano_cluster: "Ops Cluster Delta",
    caf_approved: "2025-02-11",
    mos_af: "2025-02-21",
    ic_000040_af: null,
    imp_integ_af: null,
    rfs_forecast_lock: "2025-04-02",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-18",
    lat: 3.6,
    long: 98.7
  },
  {
    system_key: "AOP-005",
    vendor_name: "Samsung Electronics Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Makassar",
    nano_cluster: "Ops Cluster Epsilon",
    caf_approved: "2025-02-06",
    mos_af: "2025-02-15",
    ic_000040_af: "2025-02-25",
    imp_integ_af: "2025-03-06",
    rfs_forecast_lock: "2025-03-24",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-10",
    lat: -5.1,
    long: 119.4
  },
  {
    system_key: "AOP-006",
    vendor_name: "Nokia Solutions and Networks Indonesia",
    program_report: "AOP Alignment Wave 2",
    imp_ttp: "Balikpapan",
    nano_cluster: "Ops Cluster Zeta",
    caf_approved: "2025-02-04",
    mos_af: "2025-02-12",
    ic_000040_af: "2025-02-20",
    imp_integ_af: "2025-02-28",
    rfs_forecast_lock: "2025-03-15",
    rfs_af: "2025-03-12",
    mocn_activation_forecast: "2025-02-26",
    endorse_af: "2025-03-17",
    lat: -1.27,
    long: 116.83
  },
  {
    system_key: "AOP-007",
    vendor_name: "Huawei Technologies Indonesia",
    program_report: "AOP Reinforcement",
    imp_ttp: "Denpasar",
    nano_cluster: "Ops Cluster Eta",
    caf_approved: "2025-02-09",
    mos_af: "2025-02-17",
    ic_000040_af: "2025-02-25",
    imp_integ_af: "2025-03-07",
    rfs_forecast_lock: "2025-03-26",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-12",
    lat: -8.65,
    long: 115.21
  },
  {
    system_key: "AOP-008",
    vendor_name: "Ericsson Indonesia",
    program_report: "AOP Reinforcement",
    imp_ttp: "Semarang",
    nano_cluster: "Ops Cluster Theta",
    caf_approved: "2025-02-07",
    mos_af: "2025-02-14",
    ic_000040_af: "2025-02-23",
    imp_integ_af: "2025-03-04",
    rfs_forecast_lock: "2025-03-21",
    rfs_af: null,
    mocn_activation_forecast: "2025-03-05",
    hotnews_af: "2025-03-09",
    lat: -6.97,
    long: 110.42
  }
]



const INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  circle: [],
  site_category: [],
  ran_score: [],
  pm_indosat: [],        // Project filter (pm_indosat)
  wbs_status: ["Active"], // Default: show only "Active" WBS status
  year: [],
  priority_congest_urgent: [],
  trial_gb_factory: []
}

const AOP_TEMPLATE_FILTER_KEYS = [
  { key: "q" as const, label: "Search" },
  { key: "vendor_name" as const, label: "Vendor" },
  { key: "program_report" as const, label: "Program" },
  { key: "circle" as const, label: "Circle" },
  { key: "site_category" as const, label: "Site Category" },
  { key: "ran_score" as const, label: "RAN Score" },
  { key: "pm_indosat" as const, label: "Project" },
  { key: "wbs_status" as const, label: "WBS Status" },
  { key: "year" as const, label: "Year" },
  { key: "priority_congest_urgent" as const, label: "Priority" },
  { key: "trial_gb_factory" as const, label: "Trial GB Factory" }
]

function mergeWithInitialFilter(payload: Record<string, unknown>): FilterValue {
  const base = { ...INITIAL_FILTER }
  for (const { key } of AOP_TEMPLATE_FILTER_KEYS) {
    const v = payload[key]
    if (key === "q") {
      base.q = typeof v === "string" ? v : ""
    } else if (Array.isArray(v)) {
      ;(base as unknown as Record<string, unknown>)[key] = v.filter((x): x is string => typeof x === "string")
    }
  }
  return base
}

/** Isolated panel state so opening "Edit filters" does not re-render the rest of the page. */
function AopFilterEditPanel({
  value,
  onChange,
  onReset,
  selectedTemplateId,
  templates,
  templateUpdateError,
  templateDeleteError,
  templateUpdating,
  onUpdateTemplate,
  onDeleteClick,
  onSaveClick,
  onDone,
  layout = "dropdown",
}: {
  value: FilterValue
  onChange: (v: FilterValue) => void
  onReset: () => void
  selectedTemplateId: string | null
  templates: { id: string; name: string; payload: Record<string, unknown>; created_at?: string }[]
  templateUpdateError: string | null
  templateDeleteError: string | null
  templateUpdating: boolean
  onUpdateTemplate: () => void
  onDeleteClick: (t: { id: string; name: string }) => void
  onSaveClick: () => void
  onDone: () => void
  layout?: "dropdown" | "inline"
}) {
  const [createTemplateMode, setCreateTemplateMode] = useState(false)
  const panelWrapperClass =
    layout === "inline"
      ? "relative z-50 mt-2 flex max-h-[85vh] flex-col rounded-xl border border-white/10 bg-[#0F1630] p-3 shadow-xl"
      : "absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0F1630] p-3 shadow-xl"
  return (
    <>
      <button
        type="button"
        onClick={() => setCreateTemplateMode((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition ${
          createTemplateMode
            ? "border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/25"
            : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
        }`}
        title={createTemplateMode ? "Close filter panel" : "Edit filter criteria"}
      >
        <SlidersHorizontal className="h-3 w-3" />
        Edit filters
      </button>
      {createTemplateMode && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setCreateTemplateMode(false)} />
          <div className={panelWrapperClass} role="dialog" aria-label="Edit filters">
            {layout === "inline" ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <FilterBar value={value} onChange={onChange} onReset={onReset} variant="aop" endpoint="/api/aop/filters" />
                </div>
                <div className="mt-2 flex-shrink-0 border-t border-white/5 pt-2">
                  {(templateUpdateError || templateDeleteError) && (
                    <p className="mb-2 text-[10px] text-red-400">{templateUpdateError ?? templateDeleteError}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTemplateId ? (
                      <>
                        <button type="button" onClick={onUpdateTemplate} disabled={templateUpdating} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 disabled:opacity-60 disabled:cursor-not-allowed">
                          <Pencil className="h-3 w-3" />
                          {templateUpdating ? "Updating..." : "Update template"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const t = templates.find((x) => x.id === selectedTemplateId)
                            if (t) onDeleteClick({ id: t.id, name: t.name })
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-200"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete template
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={onSaveClick} className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                        <Save className="h-3 w-3" />
                        Save as template
                      </button>
                    )}
                    <button type="button" onClick={() => { setCreateTemplateMode(false); onDone() }} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/80">
                      Done
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <FilterBar value={value} onChange={onChange} onReset={onReset} variant="aop" endpoint="/api/aop/filters" />
                {(templateUpdateError || templateDeleteError) && (
                  <p className="mt-2 text-[10px] text-red-400">{templateUpdateError ?? templateDeleteError}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedTemplateId ? (
                    <>
                      <button type="button" onClick={onUpdateTemplate} disabled={templateUpdating} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed" title="Update this template with current filters">
                        <Pencil className="h-3 w-3" />
                        {templateUpdating ? "Updating..." : "Update template"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const t = templates.find((x) => x.id === selectedTemplateId)
                          if (t) onDeleteClick({ id: t.id, name: t.name })
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-200 transition hover:bg-red-500/20"
                        title="Delete this template"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete template
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={onSaveClick} className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 transition hover:bg-amber-500/20" title="Save current filters as template">
                      <Save className="h-3 w-3" />
                      Save as template
                    </button>
                  )}
                  <button type="button" onClick={() => { setCreateTemplateMode(false); onDone() }} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/80 transition hover:bg-white/10" title="Done editing filters">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

export default function AopPage() {
  const [filterValue, setFilterValue] = useState<FilterValue>(INITIAL_FILTER)
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const isMobile = useIsMobile()
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templates, setTemplates] = useState<{ id: string; name: string; payload: Record<string, unknown>; created_at?: string }[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null)
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{ id: string; name: string } | null>(null)
  const [templateUpdateError, setTemplateUpdateError] = useState<string | null>(null)
  const [templateDeleteError, setTemplateDeleteError] = useState<string | null>(null)
  const [templateUpdating, setTemplateUpdating] = useState(false)

  // Debounce filter untuk unified debouncing (300ms seperti Hermes 5G)
  const debouncedFilterValue = useDebounce(filterValue, 300)

  // OPTIMIZATION: Stabilize filter arrays to prevent unnecessary re-renders
  // Empty arrays are memoized to avoid creating new references on each render
  const stableVendorNames = useMemo(() => debouncedFilterValue.vendor_name || [], [debouncedFilterValue.vendor_name])
  const stableProgramReports = useMemo(() => debouncedFilterValue.program_report || [], [debouncedFilterValue.program_report])
  const stableCircles = useMemo(() => debouncedFilterValue.circle || [], [debouncedFilterValue.circle])
  const stableSiteCategories = useMemo(() => debouncedFilterValue.site_category || [], [debouncedFilterValue.site_category])
  const stableRanScores = useMemo(() => debouncedFilterValue.ran_score || [], [debouncedFilterValue.ran_score])
  const stablePmIndosat = useMemo(() => debouncedFilterValue.pm_indosat || [], [debouncedFilterValue.pm_indosat])
  const stableWbsStatus = useMemo(() => debouncedFilterValue.wbs_status || [], [debouncedFilterValue.wbs_status])
  const stableYears = useMemo(() => debouncedFilterValue.year || [], [debouncedFilterValue.year])
  const stablePriorityCongestUrgent = useMemo(() => debouncedFilterValue.priority_congest_urgent || [], [debouncedFilterValue.priority_congest_urgent])
  const stableTrialGbFactory = useMemo(() => debouncedFilterValue.trial_gb_factory || [], [debouncedFilterValue.trial_gb_factory])
  const stableSearch = debouncedFilterValue.q || ''

  // Fetch data from API menggunakan debounced filter with stable references
  const { data: aopData, stats: aopStats, aggregated: aopAggregated, loading: aopLoading, error: aopError } = useAopData({
    vendorNames: stableVendorNames,
    programReports: stableProgramReports,
    circles: stableCircles,
    siteCategories: stableSiteCategories,
    ranScores: stableRanScores,
    pmIndosat: stablePmIndosat,
    wbsStatus: stableWbsStatus,
    years: stableYears,
    priorityCongestUrgent: stablePriorityCongestUrgent,
    trialGbFactory: stableTrialGbFactory,
    search: stableSearch
  })
  
  // Use deferred value for rows only (heavy visual component)
  // Stats and aggregated are used directly without deferring
  const deferredAggregated = useDeferredValue(aopAggregated)

  // OPTIMIZATION: Get top issues and daily runrate from aggregated data (client-side)
  // This eliminates 2 separate API calls per filter change
  // Use aopAggregated (not deferred) to ensure data is in sync with current filter
  const topIssues = aopAggregated?.topIssues?.issues || []
  const topIssuesTotal = aopAggregated?.topIssues?.top5Count || 0
  const totalIssues = aopAggregated?.topIssues?.totalCount || 0
  const dailyRunrateData = aopAggregated?.dailyRunrate || []

  // Loading state now only depends on main aopLoading (no separate API calls)
  const isAnyDataLoading = aopLoading

  // Track when initial data has been loaded
  useEffect(() => {
    if (!isAnyDataLoading && (aopData || aopError)) {
      setHasInitialDataLoaded(true)
    }
  }, [isAnyDataLoading, aopData, aopError])

  // Use API data only - don't show placeholder data while loading
  const immediateRows = useMemo(() => {
    // Don't show data while initial loading
    if (isAnyDataLoading && !hasInitialDataLoaded) {
      return [] // Return empty array while loading
    }
    if (aopData && aopData.length > 0) {
      return aopData as MatrixRow[];
    }
    // Only show placeholder if there's an error and no data (after initial load)
    if (hasInitialDataLoaded && aopError && (!aopData || aopData.length === 0)) {
      return DASHBOARD_ROWS
    }
    return []
  }, [aopData, isAnyDataLoading, aopError, hasInitialDataLoaded])

  // OPTIMIZATION: Use deferred value to prevent UI freeze during filter changes
  // This allows React to render with stale data first, then update in background
  const rows = useDeferredValue(immediateRows)
  const isStaleData = rows !== immediateRows // True when showing stale data during transition

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
    []
  )

  // Calculate active filter count (include pm_indosat/Project, year, priority_congest_urgent, trial_gb_factory)
  const activeFilterCount = (
    (filterValue.q ? 1 : 0) +
    (filterValue.vendor_name?.length || 0) +
    (filterValue.program_report?.length || 0) +
    (filterValue.imp_ttp?.length || 0) +
    (filterValue.nano_cluster?.length || 0) +
    (filterValue.circle?.length ?? 0) +
    (filterValue.site_category?.length ?? 0) +
    (filterValue.ran_score?.length ?? 0) +
    (filterValue.pm_indosat?.length ?? 0) +
    (filterValue.wbs_status?.length ?? 0) +
    (filterValue.year?.length ?? 0) +
    (filterValue.priority_congest_urgent?.length ?? 0) +
    (filterValue.trial_gb_factory?.length ?? 0)
  )
  const hasActiveFilters = activeFilterCount > 0

  // OPTIMIZED: Use stats from API instead of calculating from rows (prevents 41k+ iterations)
  const totalSites = aopStats?.totalSites || rows.length
  const readinessCount = aopStats?.readiness || 0
  const activatedCount = aopStats?.activated || 0
  
  // Calculate PATP count (using stats from API if available)
  const patpCount = aopStats?.patp || 0

  const handleFilterChange = (value: FilterValue) => {
    // OPTIMIZED: Use startTransition untuk non-urgent state updates (mencegah UI freeze)
    startTransition(() => {
      setFilterValue(value)
    })
  }

  const handleFilterReset = () => {
    setFilterValue(INITIAL_FILTER)
  }

  const openSaveTemplateModal = () => {
    setTemplateName("")
    setTemplateSaveError(null)
    setTemplateModalOpen(true)
  }

  const fetchTemplates = useCallback(async (_caller?: string) => {
    setTemplatesLoading(true)
    try {
      const res = await fetch("/api/aop/templates?limit=50")
      const json = await res.json()
      if (json.status === "success" && Array.isArray(json.data)) {
        setTemplates(json.data)
      } else {
        setTemplates([])
      }
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  // Fetch templates once on mount so dropdown doesn't show loading on first open (H3)
  useEffect(() => {
    fetchTemplates("mount")
  }, [fetchTemplates])

  // Prefetch filter options on page load so "Edit filters" dropdowns are instant when opened.
  // Force refresh for AOP so Redis/stale cache does not serve old payload without projects.
  useEffect(() => {
    prefetchFilterOptions("/api/aop/filters", "aop", true)
  }, [])

  const handleSaveTemplate = async () => {
    const name = templateName.trim()
    if (!name) {
      setTemplateSaveError("Template name is required")
      return
    }
    setTemplateSaveError(null)
    const payload = buildTemplatePayload()
    try {
      const res = await fetch("/api/aop/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payload })
      })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateSaveError(json.message || "Failed to save template")
        return
      }
      setTemplateModalOpen(false)
      setTemplateName("")
      await fetchTemplates("after_save")
    } catch (e) {
      setTemplateSaveError(e instanceof Error ? e.message : "Failed to save template")
    }
  }

  const handleLoadTemplate = (template: { id: string; payload: Record<string, unknown> } | null) => {
    if (template === null) {
      startTransition(() => setFilterValue(INITIAL_FILTER))
      setSelectedTemplateId(null)
    } else {
      startTransition(() => setFilterValue(mergeWithInitialFilter(template.payload)))
      setSelectedTemplateId(template.id)
    }
    setLoadTemplateOpen(false)
  }

  const clearTemplatePanelErrors = () => {
    setTemplateUpdateError(null)
    setTemplateDeleteError(null)
  }

  const buildTemplatePayload = useCallback((): Record<string, unknown> => {
    const payload: Record<string, unknown> = {}
    for (const { key } of AOP_TEMPLATE_FILTER_KEYS) {
      if (key === "q") {
        const v = filterValue.q?.trim()
        payload[key] = v ?? ""
      } else {
        const arr = (filterValue as unknown as Record<string, unknown>)[key]
        payload[key] = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []
      }
    }
    return payload
  }, [filterValue])

  const handleUpdateTemplate = async () => {
    if (!selectedTemplateId || templateUpdating) return
    setTemplateUpdateError(null)
    setTemplateUpdating(true)
    const payload = buildTemplatePayload()
    try {
      const res = await fetch(`/api/aop/templates/${selectedTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload })
      })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateUpdateError(json.message || "Failed to update template")
        return
      }
      await fetchTemplates("after_update")
    } catch (e) {
      setTemplateUpdateError(e instanceof Error ? e.message : "Failed to update template")
    } finally {
      setTemplateUpdating(false)
    }
  }

  const handleDeleteTemplate = async () => {
    const t = deleteConfirmTemplate
    if (!t) return
    setTemplateDeleteError(null)
    try {
      const res = await fetch(`/api/aop/templates/${t.id}`, { method: "DELETE" })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateDeleteError(json.message || "Failed to delete template")
        return
      }
      setDeleteConfirmTemplate(null)
      if (selectedTemplateId === t.id) {
        setSelectedTemplateId(null)
        startTransition(() => setFilterValue(INITIAL_FILTER))
      }
      await fetchTemplates("after_delete")
    } catch (e) {
      setTemplateDeleteError(e instanceof Error ? e.message : "Failed to delete template")
    }
  }

  // Build export params from current filter
  const buildExportParams = () => {
    const params = new URLSearchParams()
    
    if (filterValue.q) {
      params.set('q', filterValue.q)
    }
    
    filterValue.vendor_name?.forEach((value) => {
      params.append('vendor_name', value)
    })
    
    filterValue.program_report?.forEach((value) => {
      params.append('program_report', value)
    })
    
    filterValue.circle?.forEach((value) => {
      params.append('region_circle', value)
    })
    
    filterValue.site_category?.forEach((value) => {
      params.append('site_category', value)
    })

    filterValue.ran_score?.forEach((value) => {
      params.append('ran_score', value)
    })
    
    filterValue.pm_indosat?.forEach((value) => {
      params.append('pm_indosat', value)
    })

    filterValue.wbs_status?.forEach((value) => {
      params.append('wbs_status', value)
    })
    
    filterValue.year?.forEach((value) => {
      params.append('year', value)
    })
    
    filterValue.priority_congest_urgent?.forEach((value) => {
      params.append('priority_congest_urgent', value)
    })

    filterValue.trial_gb_factory?.forEach((value) => {
      params.append('trial_gb_factory', value)
    })

    params.set('type', 'aop')
    
    return params
  }

  const handleExport = async () => {
    try {
      setExportStatus(null)
      setIsExporting(true)

      const params = buildExportParams()

      const response = await fetch(`/api/aop/export?${params.toString()}`)

      if (!response.ok) {
        let errorMessage = 'Failed to export data.'
        const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || ''

        try {
          if (contentType.includes('application/json')) {
            const payload = await response.json()
            if (payload?.message) {
              errorMessage = payload.message
            }
          } else {
            const text = await response.text()
            if (text) {
              errorMessage = text
            }
          }
        } catch {
          // ignore parse failure and fall back to the default message
        }

        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition')
      let filename = 'aop-export.xlsx'

      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i)
        if (match?.[1]) {
          filename = match[1]
        }
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setExportStatus({
        type: 'success',
        message: 'AOP data downloaded successfully.'
      })
    } catch (error) {
      console.error('Failed to export AOP data', error)
      const message = error instanceof Error ? error.message : 'An error occurred during export.'
      setExportStatus({
        type: 'error',
        message
      })
    } finally {
      setIsExporting(false)
    }
  }

  const selectedTemplateName = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId)?.name : null

  const filterPanel = (
    <div className="flex h-full flex-col gap-3">
      {/* Row 1 + floating Edit filters panel (dropdown-style) */}
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setLoadTemplateOpen((o) => !o)
                if (!loadTemplateOpen && templates.length === 0) fetchTemplates("dropdown_open")
              }}
              className="inline-flex min-w-[140px] items-center justify-between gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
              title="Select a template"
            >
              <FolderOpen className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{selectedTemplateName ?? "Select template"}</span>
              <ChevronDown className={`h-3 w-3 flex-shrink-0 transition ${loadTemplateOpen ? "rotate-180" : ""}`} />
            </button>
            {loadTemplateOpen && (
              <>
                <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border border-white/10 bg-[#0F1630] py-1 shadow-lg">
                  {templatesLoading ? (
                    <div className="px-3 py-2 text-[10px] text-white/50">Loading...</div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleLoadTemplate(null)}
                        className="w-full px-3 py-1.5 text-left text-[10px] text-white/90 hover:bg-white/10"
                      >
                        All data
                      </button>
                      {templates.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-white/50">No templates saved yet.</div>
                      ) : (
                        templates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleLoadTemplate({ id: t.id, payload: t.payload })}
                            className="w-full px-3 py-1.5 text-left text-[10px] text-white/90 hover:bg-white/10"
                          >
                            {t.name}
                            {t.created_at && (
                              <span className="ml-1 text-white/50">
                                ({new Date(t.created_at).toLocaleDateString()})
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </>
                  )}
                </div>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setLoadTemplateOpen(false)}
                />
              </>
            )}
          </div>
        <AopFilterEditPanel
          value={filterValue}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
          selectedTemplateId={selectedTemplateId}
          templates={templates}
          templateUpdateError={templateUpdateError}
          templateDeleteError={templateDeleteError}
          templateUpdating={templateUpdating}
          onUpdateTemplate={handleUpdateTemplate}
          onDeleteClick={(t) => setDeleteConfirmTemplate({ id: t.id, name: t.name })}
          onSaveClick={openSaveTemplateModal}
          onDone={clearTemplatePanelErrors}
        />
        </div>
      </div>

      {/* Delete template confirmation modal */}
      {deleteConfirmTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal aria-labelledby="delete-template-title">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0F1630] p-4 shadow-xl">
            <h2 id="delete-template-title" className="mb-3 text-sm font-semibold text-white">Delete template</h2>
            <p className="mb-3 text-[11px] text-white/80">
              Delete template &quot;{deleteConfirmTemplate.name}&quot;? This cannot be undone.
            </p>
            {templateDeleteError && (
              <p className="mb-2 text-[10px] text-red-400">{templateDeleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteConfirmTemplate(null); setTemplateDeleteError(null) }}
                className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-medium text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplate}
                className="rounded-md border border-red-500/40 bg-red-500/20 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal aria-labelledby="save-template-title">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0F1630] p-4 shadow-xl">
            <h2 id="save-template-title" className="mb-3 text-sm font-semibold text-white">Save filter template</h2>
            <div className="mb-3">
              <label htmlFor="template-name" className="mb-1 block text-[10px] text-white/60">Template name</label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Jakarta Wave 1"
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/40"
                autoFocus
              />
            </div>
            {templateSaveError && (
              <p className="mb-2 text-[10px] text-red-400">{templateSaveError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setTemplateModalOpen(false); setTemplateSaveError(null) }}
                className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-medium text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-200 hover:bg-amber-500/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {(aopLoading || isStaleData) && (
        <p className="text-[10px] text-white/50 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/50 animate-pulse" />
          {aopLoading ? 'Loading AOP data...' : 'Updating...'}
        </p>
      )}
      {aopError && (
        <p className="text-[10px] text-red-400">
          Error: {aopError}. Using placeholder data.
        </p>
      )}
      {!aopLoading && !aopError && (
        <div className="space-y-0.5 text-[10px]">
          {(!aopData || aopData.length === 0) && (
            <p className="text-white/50">
              Placeholder dataset. No AOP data found in database.
            </p>
          )}
          <p className="max-w-xl text-[10px] font-semibold text-amber-200/90">
            Note:{" "}
            <span className="font-semibold text-white/90">
              Shows RF Site Category sites only, excluding the Hermes 5G scope.
            </span>
          </p>
        </div>
      )}
    </div>
  )

  // OPTIMIZED: Pass stats dari API ke MatrixStatsCard untuk menghindari redundant calculation
  // Stats dari API sudah dihitung di database, lebih cepat daripada calculate di frontend
  const matrixStats = <MatrixStatsCard 
    rows={rows} 
    patpCount={patpCount} 
    variant="aop"
    stats={aopStats ? {
      totalSites: aopStats.totalSites,
      // RFI tidak ada di stats API, calculate dari rows sebagai fallback
      rfi: undefined, // Will be calculated from rows in MatrixStatsCard
      crfi: aopStats.caf, // CRFI = caf (rfi_accepted)
      mos: aopStats.mos,
      install: aopStats.install,
      rfs: aopStats.activated, // RFS = activated (rfs_af)
      rfc: aopStats.rfc,
      fatp: aopStats.fatp,
      patp: aopStats.patp,
      hotnews: aopStats.hotnews,
      endorse: aopStats.endorse,
      pac: aopStats.pac
    } : undefined}
  />
  // OPTIMIZATION: Pass pre-aggregated data to avoid 41k row iterations in each component
  const readinessCard = <FiveGReadinessCard 
    rows={rows} 
    maxCities={8} 
    variant="circle" 
    dataVariant="aop" 
    aggregatedByCircle={deferredAggregated?.byCircle}
  />
  const activatedCard = <FiveGActivatedCard 
    rows={rows} 
    maxCities={8} 
    variant="circle" 
    dataVariant="aop" 
    aggregatedByCircle={deferredAggregated?.byCircle}
  />
  const gapStatusCard = <GapStatusCard rows={rows} isLoading={aopLoading} />
  const isLebaranTemplate = selectedTemplateName?.toLowerCase().includes('lebaran')
  const progressCurve = (
    <ProgressCurveLineChart
      rows={rows}
      anchorDate={new Date().toISOString()}
      yearFilter={2026}
      forecastSource={isLebaranTemplate ? 'rfs_forecast' : 'rfs_ff'}
      hideBaseline={isLebaranTemplate}
    />
  )
  const dailyRunrate = (
    <DailyRunrateCard 
      data={dailyRunrateData} 
      isLoading={aopLoading} 
    />
  )
  const topIssueCard = (
    <TopIssueCard
      issues={topIssues}
      totalIssues={totalIssues}
      topIssuesTotal={topIssuesTotal}
      isLoading={aopLoading}
    />
  )
  const agingPo = <AgingPoCard rows={rows} isLoading={aopLoading} />
  const circleAchievement = <CircleAchievementCard rows={rows} isLoading={aopLoading} />

  // Export button component
  const exportButton = (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-[0.32em]"
      title={isExporting ? 'Exporting...' : 'Export to Excel'}
    >
      <Download className="h-3 w-3" />
      {isExporting ? 'Exporting...' : 'Export'}
    </button>
  )

  const header = (
    <ProgramHeader 
      title="Dashboard AOP" 
      dateLabel={formattedDate} 
      mapHref="/aop/map"
      exportButton={exportButton}
    />
  )

  const wallboardView = (
    <Wallboard1080
      header={header}
      filterBar={filterPanel}
      matrixStats={matrixStats}
      readinessCard={readinessCard}
      activatedCard={activatedCard}
      progressCurve={progressCurve}
      dailyRunrate={dailyRunrate}
      top5Issue={topIssueCard}
      nanoCluster={gapStatusCard}
      newFeature={agingPo}
      leaderboard={circleAchievement}
    />
  )

  const renderMobileCard = (node: ReactNode, minHeight?: number) => {
    const style: CSSProperties = minHeight
      ? { minHeight, height: minHeight }
      : {}

    return (
      <div className="w-full flex flex-col" style={style}>
        {node}
      </div>
    )
  }

  const mobileLayout = (
    <div className="min-h-screen bg-[#050B1B] text-white flex flex-col">
      <header className="bg-gradient-to-b from-[#121c3e] to-transparent px-4 pt-5 pb-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20 transition"
            >
              <svg 
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex justify-center">
            <img
              src="/logo-indosat-putih.png"
              alt="Indosat Logo"
              className="h-8"
            />
          </div>

          <div className="flex-1 text-right text-[11px] leading-tight text-white/80">
            <div className="font-medium">{formattedDate}</div>
          </div>
        </div>

        <h1 className="mt-4 text-center text-xl font-semibold tracking-wide text-white">
          DASHBOARD AOP
        </h1>
        <div className="mt-3 flex justify-center gap-3 text-[11px] uppercase tracking-[0.32em]">
          <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">Overview</span>
          <Link
            href="/aop/map"
            className="rounded-full border border-white/20 px-3 py-1 font-medium text-white/80 transition hover:bg-white/10"
          >
            Map
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        <section className="px-4 pt-4">
          <div data-mobile-templates-card className="rounded-2xl border border-white/10 bg-[#111d41]/90 backdrop-blur-sm shadow-[0_10px_30px_rgba(5,11,27,0.45)] overflow-visible">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-white/80" />
                <span>Templates</span>
                {selectedTemplateName && (
                  <span className="truncate max-w-[120px] text-[11px] font-normal text-white/70">
                    ({selectedTemplateName})
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isMobileFilterOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isMobileFilterOpen && (
              <div className="border-t border-white/10 bg-[#050B1B]/60 px-3 py-3 space-y-3">
                {/* Template selector + Edit filters + floating panel (same as desktop) */}
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLoadTemplateOpen((o) => !o)
                          if (!loadTemplateOpen && templates.length === 0) fetchTemplates("dropdown_open")
                        }}
                        className="inline-flex w-full min-w-0 items-center justify-between gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-200"
                      >
                        <FolderOpen className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{selectedTemplateName ?? "Select template"}</span>
                        <ChevronDown className={`h-3 w-3 flex-shrink-0 ${loadTemplateOpen ? "rotate-180" : ""}`} />
                      </button>
                      {loadTemplateOpen && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-white/10 bg-[#0F1630] py-1 shadow-lg">
                          {templatesLoading ? (
                            <div className="px-3 py-2 text-[10px] text-white/50">Loading...</div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLoadTemplate(null)}
                                className="w-full px-3 py-1.5 text-left text-[10px] text-white/90 hover:bg-white/10"
                              >
                                All data
                              </button>
                              {templates.length === 0 ? (
                                <div className="px-3 py-2 text-[10px] text-white/50">No templates saved yet.</div>
                              ) : (
                                templates.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleLoadTemplate({ id: t.id, payload: t.payload })}
                                    className="w-full px-3 py-1.5 text-left text-[10px] text-white/90 hover:bg-white/10"
                                  >
                                    {t.name}
                                  </button>
                                ))
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <AopFilterEditPanel
                      value={filterValue}
                      onChange={handleFilterChange}
                      onReset={handleFilterReset}
                      selectedTemplateId={selectedTemplateId}
                      templates={templates}
                      templateUpdateError={templateUpdateError}
                      templateDeleteError={templateDeleteError}
                      templateUpdating={templateUpdating}
                      onUpdateTemplate={handleUpdateTemplate}
                      onDeleteClick={(t) => setDeleteConfirmTemplate({ id: t.id, name: t.name })}
                      onSaveClick={openSaveTemplateModal}
                      onDone={clearTemplatePanelErrors}
                      layout="inline"
                    />
                  </div>
                </div>

                {aopLoading && (
                  <p className="text-[11px] text-white/50">Loading AOP data...</p>
                )}
                {aopError && (
                  <p className="text-[11px] text-red-400">Error: {aopError}. Using placeholder data.</p>
                )}
                {!aopLoading && !aopError && aopData && aopData.length > 0 && (
                  <p className="text-[11px] text-white/50">Live AOP operational metrics from database ({aopData.length} sites).</p>
                )}
                {!aopLoading && !aopError && (!aopData || aopData.length === 0) && (
                  <p className="text-[11px] text-white/50">Placeholder data shown. No AOP data found in database.</p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="px-4 pt-4 pb-8 space-y-4">
          {renderMobileCard(matrixStats)}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderMobileCard(readinessCard, 260)}
            {renderMobileCard(activatedCard, 260)}
          </div>

          {renderMobileCard(progressCurve, 280)}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderMobileCard(dailyRunrate, 280)}
            {renderMobileCard(topIssueCard, 280)}
          </div>

          {renderMobileCard(gapStatusCard, 200)}
          {renderMobileCard(agingPo, 200)}
          {renderMobileCard(circleAchievement, 280)}
        </section>
      </main>
    </div>
  )

  // Show loading screen while fetching initial data
  if (!hasInitialDataLoaded) {
    const loadingMessage = aopLoading 
      ? "Retrieving latest AOP operational metrics from database..."
      : "Initializing dashboard..."
    return <AopLoadingScreen message={loadingMessage} />
  }

  return isMobile ? mobileLayout : wallboardView
}

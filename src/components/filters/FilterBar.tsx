"use client"

import { useEffect, useState, useCallback, useTransition, useRef, type CSSProperties } from "react"
import { Search, Tag, X } from "lucide-react"
import { MultiSelect } from "@/components/ui/MultiSelect"
import { useDebounce } from "@/hooks/useDebounce"
import { getDisplayNameForProgramReport } from "@/lib/hermes-program-mapping"

// Tipe filter value
export interface FilterValue {
  q: string
  vendor_name: string[]
  program_report: string[]
  imp_ttp: string[]
  nano_cluster: string[]
  status: string[] // New status filter array
  region?: string[]
  year?: string[] // Year filter
  circle?: string[]
  site_category?: string[] // Site category filter for AOP
  ran_score?: string[] // RAN Score filter (Hermes / default variant)
  pm_indosat?: string[] // Project filter for AOP (column pm_indosat)
  wbs_status?: string[] // WBS Status filter for AOP
  priority_congest_urgent?: string[] // Priority filter for AOP
  trial_gb_factory?: string[] // Trial GB Factory (pic_indosat); blank = "Other"
}

// Props untuk FilterBar
export interface FilterBarProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  onReset?: () => void
  variant?: "default" | "aop"
  /** When true (e.g. Hermes page), render all filters in one horizontal row with horizontal scroll on narrow viewports. Only applies to variant "default". */
  singleRow?: boolean
  endpoint?: string
  /** Filter fields to omit from UI and active-filter chips (dashboard-specific) */
  hiddenFilters?: ReadonlyArray<keyof FilterValue>
}

// Tipe data filter options
interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
  nanoClusters: string[]
  regions: string[]
  years: string[] // Years for Hermes 5G
  circles: string[]
  siteCategories?: string[] // Site categories for AOP
  ranScores?: string[] // RAN Scores (Hermes / default variant)
  projects?: string[] // Project options for AOP (pm_indosat)
  wbsStatus?: string[] // WBS Status for AOP
  priorityCongestUrgent?: string[] // Priority filter for AOP
  trialGbFactory?: string[] // Trial GB Factory (pic_indosat); blank shown as "Other"
}

// In-memory cache to avoid re-fetching options on remounts.
// Keyed by variant+endpoint, short TTL, safe (no secrets).
const FILTER_OPTIONS_CACHE = new Map<string, { options: FilterOptions; fetchedAt: number }>()
const FILTER_OPTIONS_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Prefetch filter options into the shared cache so that when the user opens
 * "Edit filters" the dropdowns are already populated (no wait on first open).
 * Call this when the page mounts (e.g. AOP page) with the same endpoint/variant
 * used by FilterBar.
 * @param forceRefresh - If true, bypasses server cache so options (e.g. projects) are fresh from DB. Use for AOP on first load when Redis may have stale shape.
 */
export async function prefetchFilterOptions(
  endpoint: string,
  variant: 'default' | 'aop' = 'default',
  forceRefresh = false
): Promise<void> {
  const cacheKey = `${variant}:${endpoint}`
  const cached = FILTER_OPTIONS_CACHE.get(cacheKey)
  if (!forceRefresh && cached && (Date.now() - cached.fetchedAt) < FILTER_OPTIONS_TTL_MS) {
    return
  }
  try {
    const url = forceRefresh ? `${endpoint}?refresh=true` : endpoint
    const response = await fetch(url)
    if (!response.ok) return
    const data = await response.json()
    if (data.status !== 'success') return
    const options: FilterOptions = {
      vendors: data.data.vendors || [],
      programs: data.data.programs || [],
      cities: data.data.cities || [],
      nanoClusters: data.data.nanoClusters || [],
      regions: data.data.regions || [],
      years: data.data.years || [],
      circles: data.data.circles || [],
      siteCategories: data.data.siteCategories || [],
      ranScores: data.data.ranScores || [],
      projects: data.data.projects || [],
      wbsStatus: data.data.wbsStatus || [],
      priorityCongestUrgent: data.data.priorityCongestUrgent || [],
      trialGbFactory: data.data.trialGbFactory || []
    }
    FILTER_OPTIONS_CACHE.set(cacheKey, { options, fetchedAt: Date.now() })
  } catch {
    // Prefetch is best-effort; FilterBar will refetch when opened if needed
  }
}

// Fungsi helper untuk memendekkan teks yang terlalu panjang
const truncateText = (text: string | undefined | null, maxLength: number = 20): string => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function FilterBar({ value, onChange, onReset, variant = "default", singleRow = false, endpoint = "/api/filters", hiddenFilters = [] }: FilterBarProps) {
  const [, startTransition] = useTransition()
  const cacheKey = `${variant}:${endpoint}`
  const hiddenFilterSet = new Set(hiddenFilters)
  const isFilterHidden = (key: keyof FilterValue) => hiddenFilterSet.has(key)
  // State lokal untuk search input (sebelum debounce)
  const [searchInput, setSearchInput] = useState(value.q)
  
  // Initialize options from cache immediately if available (even if stale) to keep dropdowns interactive
  const cachedOnMount = FILTER_OPTIONS_CACHE.get(cacheKey)
  const [options, setOptions] = useState<FilterOptions>(
    cachedOnMount?.options || {
      vendors: [],
      programs: [],
      cities: [],
      nanoClusters: [],
      regions: [],
      years: [],
      circles: [],
      siteCategories: [],
      ranScores: [],
      projects: [],
      wbsStatus: [],
      priorityCongestUrgent: [],
      trialGbFactory: []
    }
  )
  
  // State untuk loading - start as false if we have cached options
  const [isLoading, setIsLoading] = useState(!cachedOnMount)
  
  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 250)
  
  // Fetch filter options dari API
  useEffect(() => {
    let isMounted = true
    let hasRetried = false
    
    async function fetchOptions(forceRefresh = false) {
      try {
        // Use cache on remount to keep dropdowns interactive immediately.
        const cached = FILTER_OPTIONS_CACHE.get(cacheKey)
        const isCacheFresh = !!cached && (Date.now() - cached.fetchedAt) < FILTER_OPTIONS_TTL_MS
        
        // If cache is fresh and not forcing refresh, use cache and skip fetch
        if (!forceRefresh && isCacheFresh) {
          startTransition(() => {
            setOptions(cached!.options)
            setIsLoading(false)
          })
          return
        }

        // If we have stale cache, keep it visible but fetch in background
        // Only set loading=true if we don't have ANY cached options
        if (!cached) {
          setIsLoading(true)
        }
        // Force refresh on initial load to ensure fresh data with new mapping
        const url = forceRefresh ? `${endpoint}?refresh=true` : endpoint
        const response = await fetch(url)
        
        if (!isMounted) return
        
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success') {
            const newOptions: FilterOptions = {
              vendors: data.data.vendors || [],
              programs: data.data.programs || [],
              cities: data.data.cities || [],
              nanoClusters: data.data.nanoClusters || [],
              regions: data.data.regions || [],
              years: data.data.years || [],
              circles: data.data.circles || [],
              siteCategories: data.data.siteCategories || [],
              ranScores: data.data.ranScores || [],
              projects: data.data.projects || [],
              wbsStatus: data.data.wbsStatus || [],
              priorityCongestUrgent: data.data.priorityCongestUrgent || [],
              trialGbFactory: data.data.trialGbFactory || []
            }

            // Write-through cache IMMEDIATELY (before setState) so remounts are instant.
            // This ensures cache is available even if component unmounts before setState completes.
            const cacheEntry = { options: newOptions, fetchedAt: Date.now() }
            FILTER_OPTIONS_CACHE.set(cacheKey, cacheEntry)
            
            // For AOP variant: detect stale cache by checking if siteCategories are normalized
            // Normalized siteCategories should only have "New Site", "Expansion", or other short values
            // If we see long values like "New Site B2B", "Existing", cache is stale
            if (variant === 'aop' && !hasRetried && newOptions.siteCategories && newOptions.siteCategories.length > 0) {
              const hasUnnormalizedValues = newOptions.siteCategories.some((sc: string) => {
                const lower = sc.toLowerCase()
                // Check if value contains "new" but is not normalized to "New Site"
                if (lower.includes('new') && sc !== 'New Site') return true
                // Check if value contains "existing" or "upgrade" but is not normalized to "Expansion"
                if ((lower.includes('existing') || lower.includes('upgrade')) && sc !== 'Expansion') return true
                return false
              })
              
              if (hasUnnormalizedValues) {
                console.log('[FilterBar] Detected stale siteCategories cache, forcing refresh...')
                hasRetried = true
                await fetchOptions(true)
                return
              }
            }
            
            // For AOP variant: detect stale cache by checking if priorityCongestUrgent are normalized
            // Normalized priorityCongestUrgent should have:
            // - "Prio Lebaran" for values containing "prio lebaran"
            // - "P1", "P2", "P3", "P4" for values containing those priorities
            // If we see long values like "Prio Lebaran - Forecast Below 3 - P1", cache is stale
            if (variant === 'aop' && !hasRetried && newOptions.priorityCongestUrgent && newOptions.priorityCongestUrgent.length > 0) {
              const hasUnnormalizedValues = newOptions.priorityCongestUrgent.some((pcu: string) => {
                const lower = pcu.toLowerCase()
                // Check if value contains "prio lebaran" but is not normalized to "Prio Lebaran"
                if (lower.includes('prio lebaran') && pcu !== 'Prio Lebaran') {
                  return true
                }
                // Check if value contains P1, P2, P3, or P4 but is not normalized to just "P1", "P2", "P3", or "P4"
                const p1Match = lower.match(/\bp1\b/i)
                const p2Match = lower.match(/\bp2\b/i)
                const p3Match = lower.match(/\bp3\b/i)
                const p4Match = lower.match(/\bp4\b/i)
                if (p1Match && pcu !== 'P1') return true
                if (p2Match && pcu !== 'P2') return true
                if (p3Match && pcu !== 'P3') return true
                if (p4Match && pcu !== 'P4') return true
                return false
              })
              
              if (hasUnnormalizedValues) {
                console.log('[FilterBar] Detected stale priorityCongestUrgent cache, forcing refresh...')
                hasRetried = true
                await fetchOptions(true)
                return
              }
            }
            
            // OPTIMIZED: Update options immediately (not deferred) for instant dropdown opening
            // Options update is fast enough that we don't need startTransition here
            setOptions(newOptions)

          }
        }
      } catch (error) {
        console.error('Error fetching filter options:', error)
      } finally {
        if (isMounted) {
          startTransition(() => setIsLoading(false))
        }
      }
    }
    
    fetchOptions()
    
    return () => {
      isMounted = false
    }
  }, [endpoint, variant])
  
  // Update search value ketika debounce selesai
  useEffect(() => {
    if (debouncedSearch !== value.q) {
      onChange({ ...value, q: debouncedSearch })
    }
  }, [debouncedSearch, onChange, value])
  
  // Handler untuk vendor selection
  const handleVendorChange = useCallback((selected: string[]) => {
    console.log('Vendor filter changed:', selected)
    onChange({ ...value, vendor_name: selected })
  }, [onChange, value])
  
  // Handler untuk program selection
  const handleProgramChange = useCallback((selected: string[]) => {
    console.log('Program filter changed:', selected)
    onChange({ ...value, program_report: selected })
  }, [onChange, value])
  
  // Handler untuk city/imp_ttp selection
  const handleCityChange = useCallback((selected: string[]) => {
    console.log('City filter changed:', selected)
    onChange({ ...value, imp_ttp: selected })
  }, [onChange, value])
  
  // Handler untuk nano cluster selection
  const handleNanoClusterChange = useCallback((selected: string[]) => {
    console.log('Nano cluster filter changed:', selected)
    onChange({ ...value, nano_cluster: selected })
  }, [onChange, value])

  const handleCircleChange = useCallback((selected: string[]) => {
    console.log('Circle filter changed:', selected)
    onChange({ ...value, circle: selected })
  }, [onChange, value])

  // Handler untuk region selection
  const handleRegionChange = useCallback((selected: string[]) => {
    console.log('Region filter changed:', selected)
    onChange({ ...value, region: selected })
  }, [onChange, value])

  // Handler untuk year selection
  const handleYearChange = useCallback((selected: string[]) => {
    console.log('Year filter changed:', selected)
    onChange({ ...value, year: selected })
  }, [onChange, value])

  // Handler untuk site category selection (AOP variant)
  const handleSiteCategoryChange = useCallback((selected: string[]) => {
    console.log('Site category filter changed:', selected)
    onChange({ ...value, site_category: selected })
  }, [onChange, value])

  // Handler untuk RAN score selection (default/Hermes + AOP)
  const handleRanScoreChange = useCallback((selected: string[]) => {
    onChange({ ...value, ran_score: selected })
  }, [onChange, value])

  // Handler untuk Project selection (AOP variant, pm_indosat)
  const handleProjectChange = useCallback((selected: string[]) => {
    onChange({ ...value, pm_indosat: selected })
  }, [onChange, value])
  
  // Handler untuk Priority Congest Urgent selection (AOP variant)
  const handlePriorityCongestUrgentChange = useCallback((selected: string[]) => {
    console.log('Priority Congest Urgent filter changed:', selected)
    onChange({ ...value, priority_congest_urgent: selected })
  }, [onChange, value])

  // Handler untuk Trial GB Factory selection (AOP variant)
  const handleTrialGbFactoryChange = useCallback((selected: string[]) => {
    onChange({ ...value, trial_gb_factory: selected })
  }, [onChange, value])

  // Handler untuk WBS Status selection (AOP variant)
  const handleWbsStatusChange = useCallback((selected: string[]) => {
    onChange({ ...value, wbs_status: selected })
  }, [onChange, value])

  // Handler untuk reset semua filter
  const handleReset = () => {
    setSearchInput("")
    onReset?.()
    onChange({ q: "", vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [], status: [], region: [], year: [], circle: [], site_category: [], ran_score: [], pm_indosat: [], wbs_status: [], priority_congest_urgent: [], trial_gb_factory: [] })
  }

  // Handler untuk remove individual filter
  const removeFilter = (type: keyof FilterValue, item?: string) => {
    if (type === 'q') {
      setSearchInput("")
      onChange({ ...value, q: "" })
    } else if (item && Array.isArray(value[type])) {
      onChange({
        ...value,
        [type]: (value[type] as string[]).filter(val => val !== item)
      })
    }
  }
  
  // Cek apakah ada filter aktif
  const hasActiveFilters = 
    value.q !== "" || 
    (!isFilterHidden('vendor_name') && (value.vendor_name?.length || 0) > 0) || 
    (!isFilterHidden('program_report') && (value.program_report?.length || 0) > 0) || 
    (!isFilterHidden('imp_ttp') && (value.imp_ttp?.length || 0) > 0) ||
    (!isFilterHidden('nano_cluster') && (value.nano_cluster?.length || 0) > 0) ||
    (!isFilterHidden('region') && (value.region?.length || 0) > 0) ||
    (!isFilterHidden('year') && (value.year?.length || 0) > 0) ||
    (!isFilterHidden('circle') && (value.circle?.length || 0) > 0) ||
    (value.status?.length || 0) > 0 ||
    (!isFilterHidden('site_category') && (value.site_category?.length || 0) > 0) ||
    (!isFilterHidden('ran_score') && (value.ran_score?.length || 0) > 0) ||
    (!isFilterHidden('pm_indosat') && (value.pm_indosat?.length || 0) > 0) ||
    (!isFilterHidden('wbs_status') && (value.wbs_status?.length || 0) > 0) ||
    (!isFilterHidden('priority_congest_urgent') && (value.priority_congest_urgent?.length || 0) > 0) ||
    (!isFilterHidden('trial_gb_factory') && (value.trial_gb_factory?.length || 0) > 0)

  const singleRowFilterCount = [
    'vendor_name',
    'program_report',
    'imp_ttp',
    'nano_cluster',
    'circle',
    'year',
    'ran_score',
  ].filter((key) => !isFilterHidden(key as keyof FilterValue)).length

  // Single-row layout for Hermes (variant default + singleRow): one compact row, no scroll, fits viewport
  const isHermesSingleRow = variant === "default" && singleRow

  // Use inline grid columns — dynamic Tailwind arbitrary values (repeat(N,...)) are not generated at build time
  const singleRowGridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(0, 1.4fr) repeat(${singleRowFilterCount}, minmax(0, 1fr)) auto`,
  }

  const rowGridClass =
    "grid grid-cols-2 sm:grid-cols-6 gap-x-2 gap-y-2.5 text-xs flex-shrink-0 w-full items-center"
  const cellClass = "min-w-0"

  return (
    <div className="h-full flex flex-col min-w-0">
      {isHermesSingleRow ? (
        /* Hermes: all filters in one row — CSS Grid so everything fits without horizontal scroll */
        <div
          className="grid gap-1.5 w-full items-center text-xs"
          style={singleRowGridStyle}
        >
          <div className="min-w-0 relative">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by site..."
              className="w-full min-w-0 bg-white/5 rounded-md h-6 pl-5 pr-5 text-xs text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-white/20"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="min-w-0">
            <MultiSelect options={options.vendors} selected={value.vendor_name} placeholder="Vendor" onChange={handleVendorChange} disabled={false} width="w-full" staticLabel />
          </div>
          {!isFilterHidden('program_report') && (
            <div className="min-w-0">
              <MultiSelect options={options.programs} selected={value.program_report} placeholder="Program" onChange={handleProgramChange} disabled={false} width="w-full" staticLabel />
            </div>
          )}
          <div className="min-w-0">
            <MultiSelect options={options.cities} selected={value.imp_ttp} placeholder="City" onChange={handleCityChange} disabled={false} width="w-full" staticLabel />
          </div>
          <div className="min-w-0">
            <MultiSelect options={options.nanoClusters} selected={value.nano_cluster} placeholder="Cluster" onChange={handleNanoClusterChange} disabled={false} width="w-full" staticLabel />
          </div>
          <div className="min-w-0">
            <MultiSelect options={options.circles} selected={value.circle || []} placeholder="Circle" onChange={handleCircleChange} disabled={false} width="w-full" staticLabel />
          </div>
          <div className="min-w-0">
            <MultiSelect options={options.years || []} selected={value.year || []} placeholder="Year" onChange={handleYearChange} disabled={false} width="w-full" staticLabel />
          </div>
          <div className="min-w-0">
            <MultiSelect options={options.ranScores || []} selected={value.ran_score ?? []} placeholder="RAN Score" onChange={handleRanScoreChange} disabled={false} width="w-full" staticLabel />
          </div>
          <div className="flex justify-end min-w-0">
            <button
              type="button"
              onClick={handleReset}
              className={`inline-flex items-center justify-center rounded-md h-6 px-1.5 text-xs font-semibold transition-colors border flex-shrink-0 ${
                hasActiveFilters ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-white/5 bg-transparent text-gray-400 cursor-not-allowed'
              }`}
              disabled={!hasActiveFilters}
              aria-label="Reset filters"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1: Search + first set of filters — fixed 5 columns, no wrap */}
          <div className={rowGridClass}>
            <div className={`${cellClass} col-span-2 sm:col-span-1 relative`}>
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by site name, vendor, system key, site ID..."
                className="w-full bg-white/5 rounded-md h-7 pl-6 pr-6 text-xs text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-white/20"
              />
              {searchInput && (
                <button 
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {variant === "aop" ? (
              <>
                <div className={cellClass}><MultiSelect options={options.vendors} selected={value.vendor_name} placeholder="Vendor" onChange={handleVendorChange} disabled={false} width="w-full" staticLabel /></div>
                {!isFilterHidden('program_report') && (
                  <div className={cellClass}><MultiSelect options={options.programs} selected={value.program_report} placeholder="Program" onChange={handleProgramChange} disabled={false} width="w-full" staticLabel /></div>
                )}
                <div className={cellClass}><MultiSelect options={options.circles} selected={value.circle ?? []} placeholder="Circle" onChange={handleCircleChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.siteCategories || []} selected={value.site_category ?? []} placeholder="Site Category" onChange={handleSiteCategoryChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.ranScores || []} selected={value.ran_score ?? []} placeholder="RAN Score" onChange={handleRanScoreChange} disabled={false} width="w-full" staticLabel /></div>
              </>
            ) : (
              <>
                <div className={cellClass}><MultiSelect options={options.vendors} selected={value.vendor_name} placeholder="Vendor" onChange={handleVendorChange} disabled={false} width="w-full" staticLabel /></div>
                {!isFilterHidden('program_report') && (
                  <div className={cellClass}><MultiSelect options={options.programs} selected={value.program_report} placeholder="Program" onChange={handleProgramChange} disabled={false} width="w-full" staticLabel /></div>
                )}
                <div className={cellClass}><MultiSelect options={options.cities} selected={value.imp_ttp} placeholder="City" onChange={handleCityChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.nanoClusters} selected={value.nano_cluster} placeholder="Cluster" onChange={handleNanoClusterChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.circles} selected={value.circle || []} placeholder="Circle" onChange={handleCircleChange} disabled={false} width="w-full" staticLabel /></div>
              </>
            )}
          </div>

          {/* Row 2: Remaining filters + Reset — AOP: 6 columns (5 filters + reset); default: Year + RAN + reset */}
          <div className={`${variant === "aop" ? "grid grid-cols-2 sm:grid-cols-6 gap-x-2 gap-y-2.5 text-xs flex-shrink-0 w-full items-center mt-2.5" : `${rowGridClass} mt-2.5`}`}>
            {variant === "aop" ? (
              <>
                <div className={cellClass}><MultiSelect options={options.projects || []} selected={value.pm_indosat ?? []} placeholder="Project" onChange={handleProjectChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.years || []} selected={value.year ?? []} placeholder="Year" onChange={handleYearChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.priorityCongestUrgent || []} selected={value.priority_congest_urgent ?? []} placeholder="Priority" onChange={handlePriorityCongestUrgentChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.trialGbFactory || []} selected={value.trial_gb_factory ?? []} placeholder="Trial GB Factory" onChange={handleTrialGbFactoryChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.wbsStatus || []} selected={value.wbs_status ?? []} placeholder="WBS Status" onChange={handleWbsStatusChange} disabled={false} width="w-full" staticLabel caseInsensitiveMatch /></div>
                <div className={`${cellClass} hidden sm:flex justify-end`}>
                  <button
                    onClick={handleReset}
                    className={`inline-flex items-center justify-center rounded-md h-7 px-2 text-xs font-semibold transition-colors border ${
                      hasActiveFilters ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-white/5 bg-transparent text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!hasActiveFilters}
                    aria-label="Reset filters"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={cellClass}><MultiSelect options={options.years || []} selected={value.year || []} placeholder="Year" onChange={handleYearChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={cellClass}><MultiSelect options={options.ranScores || []} selected={value.ran_score ?? []} placeholder="RAN Score" onChange={handleRanScoreChange} disabled={false} width="w-full" staticLabel /></div>
                <div className={`${cellClass} hidden sm:flex sm:col-start-6 justify-end`}>
                  <button
                    onClick={handleReset}
                    className={`inline-flex items-center justify-center rounded-md h-7 px-2 text-xs font-semibold transition-colors border ${
                      hasActiveFilters ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-white/5 bg-transparent text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!hasActiveFilters}
                    aria-label="Reset filters"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Reset Button - Mobile */}
      <div className="mt-3 flex justify-start md:hidden">
        <button
          onClick={handleReset}
          className={`rounded-md h-8 px-3 text-xs font-semibold inline-flex items-center gap-1 transition-colors border ${
            hasActiveFilters
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border-white/5 bg-transparent text-gray-400 cursor-not-allowed'
          }`}
          disabled={!hasActiveFilters}
          aria-label="Reset filters"
        >
          <X className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Active Filters Display - Ultra Compact with Smaller Font and Bottom Gap */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-[1.5px] text-[10px] mt-0.5 mb-1 flex-shrink-0">
          {value.q && (
            <div className="bg-blue-500/20 text-blue-300 rounded-full px-1 py-0.5 flex items-center gap-0.5">
              <span title={value.q}>Search: {truncateText(value.q, 15)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('q')} 
              />
            </div>
          )}
          
          {value.vendor_name?.map(vendor => (
            <div 
              key={`vendor-${vendor}`} 
              className="bg-purple-500/20 text-purple-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Vendor: ${vendor}`}
            >
              <span>V: {truncateText(vendor, 10)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('vendor_name', vendor)} 
              />
            </div>
          ))}
          
          {!isFilterHidden('program_report') && value.program_report?.map(program => (
            <div 
              key={`program-${program}`} 
              className="bg-green-500/20 text-green-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Program: ${program}`}
            >
              <span>P: {truncateText(program, 12)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('program_report', program)} 
              />
            </div>
          ))}
          
          {value.imp_ttp?.map(city => (
            <div 
              key={`city-${city}`} 
              className="bg-amber-500/20 text-amber-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`City: ${city}`}
            >
              <span>C: {truncateText(city, 10)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('imp_ttp', city)} 
              />
            </div>
          ))}
          
          {value.nano_cluster?.map(cluster => (
            <div 
              key={`cluster-${cluster}`} 
              className="bg-indigo-500/20 text-indigo-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Nano Cluster: ${cluster}`}
            >
              <span>N: {truncateText(cluster, 10)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('nano_cluster', cluster)} 
              />
            </div>
          ))}

          {value.year?.map(year => (
            <div 
              key={`year-${year}`} 
              className="bg-teal-500/20 text-teal-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Year: ${year}`}
            >
              <span>Y: {year}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('year', year)} 
              />
            </div>
          ))}

          {value.circle?.map(circle => (
            <div
              key={`circle-${circle}`}
              className="bg-cyan-500/20 text-cyan-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Circle: ${circle}`}
            >
              <span>Circle: {truncateText(circle, 10)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('circle', circle)}
              />
            </div>
          ))}

          {value.site_category?.map(category => (
            <div
              key={`site-category-${category}`}
              className="bg-amber-500/20 text-amber-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Site Category: ${category}`}
            >
              <span>SC: {truncateText(category, 10)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('site_category', category)}
              />
            </div>
          ))}

          {value.ran_score?.map(ranScore => (
            <div
              key={`ran-score-${ranScore}`}
              className="bg-rose-500/20 text-rose-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`RAN Score: ${ranScore}`}
            >
              <span>RS: {truncateText(ranScore, 12)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('ran_score', ranScore)}
              />
            </div>
          ))}

          {value.pm_indosat?.map(project => (
            <div
              key={`project-${project}`}
              className="bg-rose-500/20 text-rose-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Project: ${project}`}
            >
              <span>Project: {truncateText(project, 12)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('pm_indosat', project)}
              />
            </div>
          ))}

          {value.wbs_status?.map(wbs => (
            <div
              key={`wbs-status-${wbs}`}
              className="bg-emerald-500/20 text-emerald-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`WBS Status: ${wbs}`}
            >
              <span>WBS: {truncateText(wbs, 12)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('wbs_status', wbs)}
              />
            </div>
          ))}

          {value.priority_congest_urgent?.map(priority => (
            <div
              key={`priority-${priority}`}
              className="bg-violet-500/20 text-violet-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Priority: ${priority}`}
            >
              <span>P: {truncateText(priority, 12)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('priority_congest_urgent', priority)}
              />
            </div>
          ))}

          {value.trial_gb_factory?.map(tgf => (
            <div
              key={`trial-gb-factory-${tgf}`}
              className="bg-sky-500/20 text-sky-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Trial GB Factory: ${tgf}`}
            >
              <span>TGF: {truncateText(tgf, 10)}</span>
              <X
                className="h-2 w-2 cursor-pointer"
                onClick={() => removeFilter('trial_gb_factory', tgf)}
              />
            </div>
          ))}
          
          {value.status?.map(status => (
            <div 
              key={`status-${status}`} 
              className="bg-orange-500/20 text-orange-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Status: ${status}`}
            >
              <span>S: {truncateText(status, 8)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('status', status)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 

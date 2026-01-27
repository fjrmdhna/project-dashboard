"use client"

import { useEffect, useState, useCallback } from "react"
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
  ran_score?: string[] // RAN Score filter for AOP
  priority_congest_urgent?: string[] // Priority filter for AOP
}

// Props untuk FilterBar
export interface FilterBarProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  onReset?: () => void
  variant?: "default" | "aop"
  endpoint?: string
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
  ranScores?: string[] // RAN Scores for AOP
  priorityCongestUrgent?: string[] // Priority filter for AOP
}

// Fungsi helper untuk memendekkan teks yang terlalu panjang
const truncateText = (text: string | undefined | null, maxLength: number = 20): string => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function FilterBar({ value, onChange, onReset, variant = "default", endpoint = "/api/filters" }: FilterBarProps) {
  // State lokal untuk search input (sebelum debounce)
  const [searchInput, setSearchInput] = useState(value.q)
  
  // State untuk filter options
  const [options, setOptions] = useState<FilterOptions>({
    vendors: [],
    programs: [],
    cities: [],
    nanoClusters: [],
    regions: [],
    years: [],
    circles: [],
    siteCategories: [],
    ranScores: [],
    priorityCongestUrgent: []
  })
  
  // State untuk loading
  const [isLoading, setIsLoading] = useState(true)
  
  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 250)
  
  // Fetch filter options dari API
  useEffect(() => {
    let isMounted = true
    let hasRetried = false
    
    async function fetchOptions(forceRefresh = false) {
      try {
        setIsLoading(true)
        // Force refresh on initial load to ensure fresh data with new mapping
        const url = forceRefresh ? `${endpoint}?refresh=true` : endpoint
        const response = await fetch(url)
        
        if (!isMounted) return
        
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success') {
            const newOptions = {
              vendors: data.data.vendors || [],
              programs: data.data.programs || [],
              cities: data.data.cities || [],
              nanoClusters: data.data.nanoClusters || [],
              regions: data.data.regions || [],
              years: data.data.years || [],
              circles: data.data.circles || [],
              siteCategories: data.data.siteCategories || [],
              ranScores: data.data.ranScores || [],
              priorityCongestUrgent: data.data.priorityCongestUrgent || []
            }
            
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
            // Normalized priorityCongestUrgent should only have "Prio Lebaran" for values containing "prio lebaran"
            // If we see long values like "Prio Lebaran - Forecast Below 3 - P1", cache is stale
            if (variant === 'aop' && !hasRetried && newOptions.priorityCongestUrgent && newOptions.priorityCongestUrgent.length > 0) {
              const hasUnnormalizedValues = newOptions.priorityCongestUrgent.some((pcu: string) => {
                const lower = pcu.toLowerCase()
                // Check if value contains "prio lebaran" but is not normalized to "Prio Lebaran"
                return lower.includes('prio lebaran') && pcu !== 'Prio Lebaran'
              })
              
              if (hasUnnormalizedValues) {
                console.log('[FilterBar] Detected stale priorityCongestUrgent cache, forcing refresh...')
                hasRetried = true
                await fetchOptions(true)
                return
              }
            }
            
            // For AOP variant: detect stale cache by checking if ranScores are normalized
            // Normalized ranScores should only have "Co - Expansion" for values containing "co - expansion"
            // If we see long values like "CO - Expansion - Forecast", cache is stale
            if (variant === 'aop' && !hasRetried && newOptions.ranScores && newOptions.ranScores.length > 0) {
              const hasUnnormalizedValues = newOptions.ranScores.some((rs: string) => {
                const lower = rs.toLowerCase()
                // Check if value contains "co - expansion" but is not normalized to "Co - Expansion"
                return lower.includes('co - expansion') && rs !== 'Co - Expansion'
              })
              
              if (hasUnnormalizedValues) {
                console.log('[FilterBar] Detected stale ranScores cache, forcing refresh...')
                hasRetried = true
                await fetchOptions(true)
                return
              }
            }
            
            setOptions(newOptions)
          }
        }
      } catch (error) {
        console.error('Error fetching filter options:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
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

  // Handler untuk RAN score selection (AOP variant)
  const handleRanScoreChange = useCallback((selected: string[]) => {
    console.log('RAN score filter changed:', selected)
    onChange({ ...value, ran_score: selected })
  }, [onChange, value])
  
  // Handler untuk Priority Congest Urgent selection (AOP variant)
  const handlePriorityCongestUrgentChange = useCallback((selected: string[]) => {
    console.log('Priority Congest Urgent filter changed:', selected)
    onChange({ ...value, priority_congest_urgent: selected })
  }, [onChange, value])
  
  // Handler untuk reset semua filter
  const handleReset = () => {
    setSearchInput("")
    onReset?.()
    onChange({ q: "", vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [], status: [], region: [], year: [], circle: [], site_category: [], ran_score: [], priority_congest_urgent: [] })
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
    (value.vendor_name?.length || 0) > 0 || 
    (value.program_report?.length || 0) > 0 || 
    (value.imp_ttp?.length || 0) > 0 ||
    (value.nano_cluster?.length || 0) > 0 ||
    (value.region?.length || 0) > 0 ||
    (value.year?.length || 0) > 0 ||
    (value.circle?.length || 0) > 0 ||
    (value.status?.length || 0) > 0 ||
    (value.site_category?.length || 0) > 0 ||
    (value.ran_score?.length || 0) > 0 ||
    (value.priority_congest_urgent?.length || 0) > 0

  // Grid layout berbeda untuk variant AOP (7 filter: vendor, program, circle, site_category, ran_score, year, priority) vs default (7 filter dengan region dan year)
  const gridClass =
    variant === "aop"
      ? "grid grid-cols-2 gap-3 text-xs flex-shrink-0 min-w-0 w-full md:grid-cols-[minmax(0,2fr)_repeat(7,minmax(0,1fr))_auto] md:items-center md:gap-2"
      : "grid grid-cols-2 gap-3 text-xs flex-shrink-0 min-w-0 w-full md:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))_auto] md:items-center md:gap-2"
  
  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Filter Controls - Responsive grid layout */}
      <div className={gridClass}>
        {/* Search Input */}
        <div className="col-span-2 md:col-span-1 relative min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search sites, vendors..."
            className="w-full bg-white/5 rounded-md h-6 pl-6 pr-6 text-xs text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-white/20"
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

        {/* Vendor Filter */}
        <MultiSelect
          options={options.vendors}
          selected={value.vendor_name}
          placeholder="Vendor"
          onChange={handleVendorChange}
          disabled={isLoading}
          width="w-full"
          className="col-span-2 md:col-span-1"
        />

        {/* Program Filter */}
        <MultiSelect
          options={options.programs}
          selected={value.program_report}
          placeholder="Program"
          onChange={handleProgramChange}
          disabled={isLoading}
          width="w-full"
          className="col-span-2 md:col-span-1"
        />

        {/* City & Cluster Filters - Default variant only */}
        {variant !== "aop" && (
          <>
            <MultiSelect
              options={options.cities}
              selected={value.imp_ttp}
              placeholder="City"
              onChange={handleCityChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />

            <MultiSelect
              options={options.nanoClusters}
              selected={value.nano_cluster}
              placeholder="Cluster"
              onChange={handleNanoClusterChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />

            <MultiSelect
              options={options.regions}
              selected={value.region || []}
              placeholder="Region"
              onChange={handleRegionChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />

            <MultiSelect
              options={options.years}
              selected={value.year || []}
              placeholder="Year"
              onChange={handleYearChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
          </>
        )}

        {/* Circle, Site Category, RAN Score, Year Filters - AOP variant only */}
        {variant === "aop" && (
          <>
            <MultiSelect
              options={options.circles}
              selected={value.circle ?? []}
              placeholder="Circle"
              onChange={handleCircleChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
            {/* Site Category Filter */}
            <MultiSelect
              options={options.siteCategories || []}
              selected={value.site_category ?? []}
              placeholder="Site Category"
              onChange={handleSiteCategoryChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
            {/* RAN Score Filter */}
            <MultiSelect
              options={options.ranScores || []}
              selected={value.ran_score ?? []}
              placeholder="RAN Score"
              onChange={handleRanScoreChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
            {/* Year Filter */}
            <MultiSelect
              options={options.years || []}
              selected={value.year ?? []}
              placeholder="Year"
              onChange={handleYearChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
            {/* Priority Congest Urgent Filter */}
            <MultiSelect
              options={options.priorityCongestUrgent || []}
              selected={value.priority_congest_urgent ?? []}
              placeholder="Priority"
              onChange={handlePriorityCongestUrgentChange}
              disabled={isLoading}
              width="w-full"
              className="col-span-2 md:col-span-1"
            />
          </>
        )}

        {/* Reset Button - Desktop */}
        <button
          onClick={handleReset}
          className={`hidden md:inline-flex items-center justify-center md:col-span-1 md:justify-self-end rounded-md h-7 px-2 text-xs font-semibold transition-colors border ${
            hasActiveFilters
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border-white/5 bg-transparent text-gray-400 cursor-not-allowed'
          }`}
          disabled={!hasActiveFilters}
          aria-label="Reset filters"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

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
          
          {value.program_report?.map(program => (
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

          {value.region?.map(region => (
            <div 
              key={`region-${region}`} 
              className="bg-pink-500/20 text-pink-300 rounded-full px-1 py-0.5 flex items-center gap-0.5"
              title={`Region: ${region}`}
            >
              <span>R: {truncateText(region, 10)}</span>
              <X 
                className="h-2 w-2 cursor-pointer" 
                onClick={() => removeFilter('region', region)} 
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

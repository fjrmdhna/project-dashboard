"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, Tag, X } from "lucide-react"
import { MultiSelect } from "@/components/ui/MultiSelect"
import { useDebounce } from "@/hooks/useDebounce"

// Tipe filter value
export interface FilterValue {
  q: string
  vendor_name: string[]
  program_report: string[]
  imp_ttp: string[]
  nano_cluster: string[]
}

// Props untuk FilterBar
export interface FilterBarProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  onReset?: () => void
}

// Tipe data filter options
interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
  nanoClusters: string[]
}

// Fungsi helper untuk memendekkan teks yang terlalu panjang
const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function FilterBar({ value, onChange, onReset }: FilterBarProps) {
  // State lokal untuk search input (sebelum debounce)
  const [searchInput, setSearchInput] = useState(value.q)
  
  // State untuk filter options
  const [options, setOptions] = useState<FilterOptions>({
    vendors: [],
    programs: [],
    cities: [],
    nanoClusters: []
  })
  
  // State untuk loading
  const [isLoading, setIsLoading] = useState(true)
  
  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 250)
  
  // Fetch filter options dari API
  useEffect(() => {
    let isMounted = true
    
    async function fetchOptions() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/filters')
        
        if (!isMounted) return
        
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success') {
            setOptions({
              vendors: data.data.vendors || [],
              programs: data.data.programs || [],
              cities: data.data.cities || [],
              nanoClusters: data.data.nanoClusters || []
            })
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
  }, [])
  
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
  
  // Handler untuk reset semua filter
  const handleReset = () => {
    setSearchInput("")
    onReset?.()
    onChange({ q: "", vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [] })
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
    value.vendor_name.length > 0 || 
    value.program_report.length > 0 || 
    value.imp_ttp.length > 0 ||
    value.nano_cluster.length > 0
  
  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Filter Controls - Grid Layout untuk mencegah tabrakan */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] xl:grid-cols-[1fr_auto_auto_auto_auto_auto] lg:grid-cols-[1fr_auto_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_auto_auto] gap-1.5 items-center text-xs flex-shrink-0 min-w-0 max-w-full overflow-hidden">
        {/* Search Input - Takes remaining space */}
        <div className="relative min-w-[150px] max-w-[250px]">
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
          width="w-[100px]"
        />
        
        {/* Program Filter */}
        <MultiSelect
          options={options.programs}
          selected={value.program_report}
          placeholder="Program"
          onChange={handleProgramChange}
          disabled={isLoading}
          width="w-[90px]"
        />
        
        {/* City/IMP_TTP Filter */}
        <MultiSelect
          options={options.cities}
          selected={value.imp_ttp}
          placeholder="City"
          onChange={handleCityChange}
          disabled={isLoading}
          width="w-[80px]"
          className="hidden lg:block"
        />
        
        {/* Nano Cluster Filter */}
        <MultiSelect
          options={options.nanoClusters}
          selected={value.nano_cluster}
          placeholder="Cluster"
          onChange={handleNanoClusterChange}
          disabled={isLoading}
          width="w-[90px]"
          className="hidden xl:block"
        />
        
        {/* Reset Button - Fixed position, tidak akan bertabrakan */}
        <button
          onClick={handleReset}
          className={`rounded-md h-6 px-1.5 text-xs flex items-center gap-1 transition-colors justify-self-end ${
            hasActiveFilters 
              ? 'bg-white/5 hover:bg-white/10 text-white' 
              : 'bg-white/5/50 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!hasActiveFilters}
        >
          <X className="h-3 w-3" />
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
          
          {value.vendor_name.map(vendor => (
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
          
          {value.program_report.map(program => (
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
          
          {value.imp_ttp.map(city => (
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
          
          {value.nano_cluster.map(cluster => (
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
        </div>
      )}
    </div>
  )
} 
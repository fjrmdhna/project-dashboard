"use client"

import { useEffect, useState } from "react"
import { Search, Tag, X } from "lucide-react"
import { MultiSelect } from "@/components/ui/MultiSelect"
import { useDebounce } from "@/hooks/useDebounce"

// Tipe filter value
export interface FilterValue {
  q: string
  vendor_name: string[]
  program_report: string[]
  imp_ttp: string[]
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
    cities: []
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
              cities: data.data.cities || []
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
  const handleVendorChange = (selected: string[]) => {
    onChange({ ...value, vendor_name: selected })
  }
  
  // Handler untuk program selection
  const handleProgramChange = (selected: string[]) => {
    onChange({ ...value, program_report: selected })
  }
  
  // Handler untuk city/imp_ttp selection
  const handleCityChange = (selected: string[]) => {
    onChange({ ...value, imp_ttp: selected })
  }
  
  // Handler untuk reset semua filter
  const handleReset = () => {
    setSearchInput("")
    onReset?.()
    onChange({ q: "", vendor_name: [], program_report: [], imp_ttp: [] })
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
    value.imp_ttp.length > 0
  
  return (
    <div className="h-full flex flex-col">
      {/* Filter Controls - Distributed Evenly */}
      <div className="flex items-center justify-between gap-3 text-xs">
        {/* Left Side - Search Input */}
        <div className="relative w-1/4 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search sites, vendors..."
            className="w-full bg-white/5 rounded-lg h-7 pl-7 pr-7 text-xs text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-white/20"
          />
          {searchInput && (
            <button 
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        
        {/* Middle - Filter Dropdowns */}
        <div className="flex items-center gap-3 flex-1 justify-center">
        {/* Vendor Filter */}
        <MultiSelect
          options={options.vendors}
          selected={value.vendor_name}
          placeholder="Vendor"
          onChange={handleVendorChange}
          disabled={isLoading}
            width="w-[160px]"
        />
        
        {/* Program Filter */}
        <MultiSelect
          options={options.programs}
          selected={value.program_report}
          placeholder="Program"
          onChange={handleProgramChange}
          disabled={isLoading}
            width="w-[190px]"
        />
        
        {/* City/IMP_TTP Filter */}
        <MultiSelect
          options={options.cities}
          selected={value.imp_ttp}
          placeholder="City (imp_ttp)"
          onChange={handleCityChange}
          disabled={isLoading}
            width="w-[160px]"
        />
        </div>
        
        {/* Right - Reset Button */}
        <div className="w-20 text-right">
        {hasActiveFilters && (
          <button
            onClick={handleReset}
              className="bg-white/5 hover:bg-white/10 rounded-lg h-7 px-2.5 text-xs text-white flex items-center gap-1 ml-auto"
          >
              Reset <X className="h-3.5 w-3.5" />
          </button>
        )}
        </div>
      </div>

      {/* Active Filters Display - Compact and Truncated */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 text-[10px] mt-2">
          {value.q && (
            <div className="bg-blue-500/20 text-blue-300 rounded-full px-2 py-0.5 flex items-center gap-1">
              <span title={value.q}>Search: {truncateText(value.q, 25)}</span>
              <X 
                className="h-2.5 w-2.5 cursor-pointer" 
                onClick={() => removeFilter('q')} 
              />
            </div>
          )}
          
          {value.vendor_name.map(vendor => (
            <div 
              key={`vendor-${vendor}`} 
              className="bg-purple-500/20 text-purple-300 rounded-full px-2 py-0.5 flex items-center gap-1"
              title={`Vendor: ${vendor}`}
            >
              <span>V: {truncateText(vendor, 15)}</span>
              <X 
                className="h-2.5 w-2.5 cursor-pointer" 
                onClick={() => removeFilter('vendor_name', vendor)} 
              />
            </div>
          ))}
          
          {value.program_report.map(program => (
            <div 
              key={`program-${program}`} 
              className="bg-green-500/20 text-green-300 rounded-full px-2 py-0.5 flex items-center gap-1"
              title={`Program: ${program}`}
            >
              <span>P: {truncateText(program, 20)}</span>
              <X 
                className="h-2.5 w-2.5 cursor-pointer" 
                onClick={() => removeFilter('program_report', program)} 
              />
            </div>
          ))}
          
          {value.imp_ttp.map(city => (
            <div 
              key={`city-${city}`} 
              className="bg-amber-500/20 text-amber-300 rounded-full px-2 py-0.5 flex items-center gap-1"
              title={`City: ${city}`}
            >
              <span>C: {truncateText(city, 15)}</span>
              <X 
                className="h-2.5 w-2.5 cursor-pointer" 
                onClick={() => removeFilter('imp_ttp', city)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 
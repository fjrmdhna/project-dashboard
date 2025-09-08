"use client"

import { memo } from 'react'
import { Search, X, Filter, ChevronDown } from 'lucide-react'

interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
}

interface FilterState {
  searchTerm: string
  vendorFilter: string
  programFilter: string
  cityFilter: string
}

interface CompactFilterSectionProps {
  filters: FilterState
  filterOptions: FilterOptions
  onSearchChange: (search: string) => void
  onVendorChange: (vendor: string) => void
  onProgramChange: (program: string) => void
  onCityChange: (city: string) => void
  onResetFilters: () => void
  loading?: boolean
}

const CompactFilterSection = memo(function CompactFilterSection({
  filters,
  filterOptions,
  onSearchChange,
  onVendorChange,
  onProgramChange,
  onCityChange,
  onResetFilters,
  loading = false
}: CompactFilterSectionProps) {

  return (
    <div className="bg-slate-800 rounded-lg p-3 mb-2 border border-slate-700">
      <div className="flex items-center justify-between gap-4">
        {/* Left Section - Filter Label */}
        <div className="flex items-center gap-2 text-blue-400 flex-shrink-0">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold tracking-wide">FILTERS</span>
        </div>

        {/* Center Section - Search & Dropdowns */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* Search Input */}
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sites..."
              className="w-full pl-9 pr-3 py-2 text-[11px] bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/50 transition-all"
              disabled={loading}
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-3">
            {/* Vendor Filter */}
            <div className="relative">
              <select
                value={filters.vendorFilter}
                onChange={(e) => onVendorChange(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 text-[11px] bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/50 transition-all cursor-pointer min-w-[120px]"
                disabled={loading}
              >
                <option value="all">All Vendors</option>
                {filterOptions.vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Program Filter */}
            <div className="relative">
              <select
                value={filters.programFilter}
                onChange={(e) => onProgramChange(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 text-[11px] bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/50 transition-all cursor-pointer min-w-[120px]"
                disabled={loading}
              >
                <option value="all">All Programs</option>
                {filterOptions.programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* City Filter */}
            <div className="relative">
              <select
                value={filters.cityFilter}
                onChange={(e) => onCityChange(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 text-[11px] bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/50 transition-all cursor-pointer min-w-[120px]"
                disabled={loading}
              >
                <option value="all">All Cities</option>
                {filterOptions.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Section - Reset Button & Loading */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Reset Button */}
          <button
            onClick={onResetFilters}
            className="flex items-center gap-2 px-3 py-2 text-[11px] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <X className="h-3.5 w-3.5" />
            <span className="font-medium">Reset</span>
          </button>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-blue-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
              <span className="text-[10px] font-medium">Loading...</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Indicator */}
      {(filters.searchTerm || filters.vendorFilter !== 'all' || filters.programFilter !== 'all' || filters.cityFilter !== 'all') && (
        <div className="mt-3 pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="font-medium">Active filters:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 rounded-md text-[9px] font-medium border border-blue-600/30">
                  <Search className="h-2.5 w-2.5" />
                  {filters.searchTerm}
                </span>
              )}
              {filters.vendorFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 rounded-md text-[9px] font-medium border border-purple-600/30">
                  <Filter className="h-2.5 w-2.5" />
                  {filters.vendorFilter}
                </span>
              )}
              {filters.programFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-300 rounded-md text-[9px] font-medium border border-green-600/30">
                  <Filter className="h-2.5 w-2.5" />
                  {filters.programFilter}
                </span>
              )}
              {filters.cityFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-600/20 text-orange-300 rounded-md text-[9px] font-medium border border-orange-600/30">
                  <Filter className="h-2.5 w-2.5" />
                  {filters.cityFilter}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export { CompactFilterSection } 
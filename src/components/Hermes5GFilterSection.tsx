"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw } from "lucide-react"
import { useState, useEffect } from "react"
import { useSearchDebounce } from "@/hooks/useDebounce"

interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
}

interface FilterState {
  searchTerm: string
  statusFilter: string
  regionFilter: string
  vendorFilter: string
  programFilter: string
  cityFilter: string
}

interface Hermes5GFilterSectionProps {
  filters: FilterState
  filterOptions: FilterOptions
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onRegionFilterChange: (value: string) => void
  onVendorFilterChange: (value: string) => void
  onProgramFilterChange: (value: string) => void
  onCityFilterChange: (value: string) => void
  onResetFilters: () => void
  showChartFilters?: boolean
  showTableFilters?: boolean
}

export function Hermes5GFilterSection({
  filters,
  filterOptions,
  onSearchChange,
  onStatusFilterChange,
  onRegionFilterChange,
  onVendorFilterChange,
  onProgramFilterChange,
  onCityFilterChange,
  onResetFilters,
  showChartFilters = true,
  showTableFilters = true
}: Hermes5GFilterSectionProps) {
  const [searchValue, setSearchValue] = useState(filters.searchTerm)

  // Optimized debounced search
  const { isSearching } = useSearchDebounce(
    searchValue,
    onSearchChange,
    300 // 300ms delay
  )

  // Update local search value when filters change externally
  useEffect(() => {
    setSearchValue(filters.searchTerm)
  }, [filters.searchTerm])

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          {showTableFilters && (
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search sites, vendors, or IDs... (auto search)"
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-foreground"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
            </div>
          )}
          
          {/* Filter Controls */}
          <div className="flex gap-2 flex-wrap">
            {/* Chart Filters */}
            {showChartFilters && (
              <>
                <select
                  className="px-3 py-2 border border-input rounded-md bg-background text-foreground min-w-[120px]"
                  value={filters.vendorFilter}
                  onChange={(e) => onVendorFilterChange(e.target.value)}
                >
                  <option value="all">All Vendors</option>
                  {filterOptions.vendors.map((vendor) => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
                
                <select
                  className="px-3 py-2 border border-input rounded-md bg-background text-foreground min-w-[120px]"
                  value={filters.programFilter}
                  onChange={(e) => onProgramFilterChange(e.target.value)}
                >
                  <option value="all">All Programs</option>
                  {filterOptions.programs.map((program) => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select>
                
                <select
                  className="px-3 py-2 border border-input rounded-md bg-background text-foreground min-w-[120px]"
                  value={filters.cityFilter}
                  onChange={(e) => onCityFilterChange(e.target.value)}
                >
                  <option value="all">All Cities</option>
                  {filterOptions.cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </>
            )}

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="flex items-center gap-2"
              disabled={isSearching}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
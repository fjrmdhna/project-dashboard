"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw } from "lucide-react"
import { useState, useEffect } from "react"
import { useHermes5GContext } from '@/contexts/Hermes5GContext'

interface Hermes5GCompactFilterProps {
  showChartFilters?: boolean
  showTableFilters?: boolean
}

export function Hermes5GCompactFilter({
  showChartFilters = true,
  showTableFilters = true
}: Hermes5GCompactFilterProps) {
  const {
    filters,
    filterOptions,
    tableFilters,
    setSearchTerm,
    setStatusFilter,
    setRegionFilter,
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    resetFilters,
    setCurrentPage,
    fetchSiteData
  } = useHermes5GContext()

  const [searchValue, setSearchValue] = useState(filters.searchTerm)
  const [filterLoading, setFilterLoading] = useState(false)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.searchTerm) {
        handleSearchChange(searchValue)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchValue, filters.searchTerm])

  // Update local search value when filters change externally
  useEffect(() => {
    setSearchValue(filters.searchTerm)
  }, [filters.searchTerm])

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
    setFilterLoading(true)
    fetchSiteData(1, { ...tableFilters, search: value })
    setFilterLoading(false)
  }

  const handleVendorFilterChange = (value: string) => {
    setVendorFilter(value)
    setCurrentPage(1)
  }

  const handleProgramFilterChange = (value: string) => {
    setProgramFilter(value)
    setCurrentPage(1)
  }

  const handleCityFilterChange = (value: string) => {
    setCityFilter(value)
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    resetFilters()
    setCurrentPage(1)
    setFilterLoading(true)
    fetchSiteData(1, { search: '', status: 'all', region: 'all', vendor: 'all' })
    setFilterLoading(false)
  }

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
                  onChange={(e) => handleVendorFilterChange(e.target.value)}
                >
                  <option value="all">All Vendors</option>
                  {filterOptions.vendors.map((vendor) => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
                
                <select
                  className="px-3 py-2 border border-input rounded-md bg-background text-foreground min-w-[120px]"
                  value={filters.programFilter}
                  onChange={(e) => handleProgramFilterChange(e.target.value)}
                >
                  <option value="all">All Programs</option>
                  {filterOptions.programs.map((program) => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select>
                
                <select
                  className="px-3 py-2 border border-input rounded-md bg-background text-foreground min-w-[120px]"
                  value={filters.cityFilter}
                  onChange={(e) => handleCityFilterChange(e.target.value)}
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
              onClick={handleResetFilters}
              className="flex items-center gap-2"
              disabled={filterLoading}
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
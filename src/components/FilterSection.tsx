"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Search } from "lucide-react"

interface FilterState {
  searchTerm: string
  statusFilter: string
  regionFilter: string
  vendorFilter: string
  programFilter: string
  cityFilter: string
}

interface FilterOptions {
  vendors: string[]
  programs: string[]
  cities: string[]
}

interface FilterSectionProps {
  onFiltersChange: (filters: FilterState) => void
  initialFilters?: Partial<FilterState>
}

export function FilterSection({ onFiltersChange, initialFilters }: FilterSectionProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: "",
    statusFilter: "all",
    regionFilter: "all",
    vendorFilter: "all",
    programFilter: "all",
    cityFilter: "all",
    ...initialFilters
  })

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    vendors: [],
    programs: [],
    cities: []
  })

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/hermes-5g/filter-options')
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setFilterOptions(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }))
  }

  const handleVendorFilter = (value: string) => {
    setFilters(prev => ({ ...prev, vendorFilter: value }))
  }

  const handleProgramFilter = (value: string) => {
    setFilters(prev => ({ ...prev, programFilter: value }))
  }

  const handleCityFilter = (value: string) => {
    setFilters(prev => ({ ...prev, cityFilter: value }))
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sites, vendors, or IDs..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-foreground"
                value={filters.searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              value={filters.vendorFilter}
              onChange={(e) => handleVendorFilter(e.target.value)}
            >
              <option value="all">All Vendors</option>
              {filterOptions.vendors.map((vendor) => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
            
            <select
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              value={filters.programFilter}
              onChange={(e) => handleProgramFilter(e.target.value)}
            >
              <option value="all">All Programs</option>
              {filterOptions.programs.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
            
            <select
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              value={filters.cityFilter}
              onChange={(e) => handleCityFilter(e.target.value)}
            >
              <option value="all">All Cities</option>
              {filterOptions.cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

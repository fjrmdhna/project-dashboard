import { useState, useEffect, useCallback } from 'react'

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

interface UseHermes5GFiltersReturn {
  // Filter state
  filters: FilterState
  filterOptions: FilterOptions
  
  // Filter actions
  setSearchTerm: (value: string) => void
  setStatusFilter: (value: string) => void
  setRegionFilter: (value: string) => void
  setVendorFilter: (value: string) => void
  setProgramFilter: (value: string) => void
  setCityFilter: (value: string) => void
  
  // Reset function
  resetFilters: () => void
  
  // Computed values
  chartFilters: {
    vendorFilter: string
    programFilter: string
    cityFilter: string
  }
  tableFilters: {
    search: string
    status: string
    region: string
    vendor: string
  }
}

export function useHermes5GFilters(): UseHermes5GFiltersReturn {
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: "",
    statusFilter: "all",
    regionFilter: "all",
    vendorFilter: "all",
    programFilter: "all",
    cityFilter: "all"
  })
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    vendors: [],
    programs: [],
    cities: []
  })

  // Fetch filter options on mount
  useEffect(() => {
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
    
    fetchFilterOptions()
  }, [])

  // Filter actions
  const setSearchTerm = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }))
  }, [])

  const setStatusFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, statusFilter: value }))
  }, [])

  const setRegionFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, regionFilter: value }))
  }, [])

  const setVendorFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, vendorFilter: value }))
  }, [])

  const setProgramFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, programFilter: value }))
  }, [])

  const setCityFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, cityFilter: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: "",
      statusFilter: "all",
      regionFilter: "all",
      vendorFilter: "all",
      programFilter: "all",
      cityFilter: "all"
    })
  }, [])

  // Computed values
  const chartFilters = {
    vendorFilter: filters.vendorFilter,
    programFilter: filters.programFilter,
    cityFilter: filters.cityFilter,
    searchFilter: filters.searchTerm // Add search to chart filters
  }

  const tableFilters = {
    search: filters.searchTerm,
    status: filters.statusFilter,
    region: filters.regionFilter,
    vendor: filters.vendorFilter
  }

  return {
    filters,
    filterOptions,
    setSearchTerm,
    setStatusFilter,
    setRegionFilter,
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    resetFilters,
    chartFilters,
    tableFilters
  }
} 
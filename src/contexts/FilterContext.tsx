'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { FilterState, FilterActions, FilterContextType, DEFAULT_FILTERS } from '@/types/filter'

// Create Filter Context
const FilterContext = createContext<FilterContextType | undefined>(undefined)

// Filter Provider Props
interface FilterProviderProps {
  children: ReactNode
}

// Filter Provider Component
export function FilterProvider({ children }: FilterProviderProps) {
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS)

  // Filter Actions
  const setVendorFilter = useCallback((vendor: string) => {
    setFiltersState(prev => ({ ...prev, vendorFilter: vendor }))
  }, [])

  const setProgramFilter = useCallback((program: string) => {
    setFiltersState(prev => ({ ...prev, programFilter: program }))
  }, [])

  const setCityFilter = useCallback((city: string) => {
    setFiltersState(prev => ({ ...prev, cityFilter: city }))
  }, [])

  const setSearchTerm = useCallback((search: string) => {
    setFiltersState(prev => ({ ...prev, searchTerm: search }))
  }, [])

  const setStatusFilter = useCallback((status: string) => {
    setFiltersState(prev => ({ ...prev, statusFilter: status }))
  }, [])

  const setRegionFilter = useCallback((region: string) => {
    setFiltersState(prev => ({ ...prev, regionFilter: region }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS)
  }, [])

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Context Value
  const contextValue: FilterContextType = {
    // State
    ...filters,
    
    // Actions
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    setSearchTerm,
    setStatusFilter,
    setRegionFilter,
    resetFilters,
    setFilters
  }

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  )
}

// Custom Hook to use Filter Context
export function useFilter(): FilterContextType {
  const context = useContext(FilterContext)
  
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider')
  }
  
  return context
}

// Export Filter Context for advanced usage
export { FilterContext }

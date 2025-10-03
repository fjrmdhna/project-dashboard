'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { FilterState, FilterActions, FilterContextType, DEFAULT_FILTERS } from '@/types/filter'

// Create Filter Context
const FilterContext = createContext<FilterContextType | undefined>(undefined)

// Filter Provider Props
interface FilterProviderProps {
  children: ReactNode
}

// Filter Provider Component
export function FilterProvider({ children }: FilterProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  
  // Load filters from localStorage on initialization
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS)

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hermes-filter-state')
        if (saved) {
          setFiltersState(JSON.parse(saved))
        }
      } catch (error) {
        console.warn('Failed to load filter state from localStorage:', error)
      }
    }
  }, [])

  // Save to localStorage whenever filters change
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem('hermes-filter-state', JSON.stringify(filters))
      } catch (error) {
        console.warn('Failed to save filter state to localStorage:', error)
      }
    }
  }, [filters, isHydrated])

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

  const setNanoClusterFilter = useCallback((nanoCluster: string) => {
    setFiltersState(prev => ({ ...prev, nanoClusterFilter: nanoCluster }))
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

  const setStatusFilters = useCallback((statuses: string[]) => {
    setFiltersState(prev => ({ ...prev, statusFilters: statuses }))
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
    isHydrated,
    
    // Actions
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    setNanoClusterFilter,
    setSearchTerm,
    setStatusFilter,
    setRegionFilter,
    setStatusFilters,
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

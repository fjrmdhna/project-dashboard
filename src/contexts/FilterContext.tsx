'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { FilterState, FilterActions, FilterContextType, DEFAULT_FILTERS } from '@/types/filter'

// Create Filter Context
const FilterContext = createContext<FilterContextType | undefined>(undefined)

// Filter Provider Props
interface FilterProviderProps {
  children: ReactNode
  /** Unique localStorage key per dashboard to avoid filter state collisions */
  storageKey?: string
}

// Filter Provider Component
export function FilterProvider({ children, storageKey = 'hermes-filter-state' }: FilterProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  
  // Load filters from localStorage on initialization
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS)
  
  // Debounced filters for use in hooks (300ms delay)
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(DEFAULT_FILTERS)

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          setFiltersState(prev => ({ ...DEFAULT_FILTERS, ...prev, ...parsed }))
        }
      } catch (error) {
        console.warn('Failed to load filter state from localStorage:', error)
      }
    }
  }, [storageKey])

  // Save to localStorage whenever filters change
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters))
      } catch (error) {
        console.warn('Failed to save filter state to localStorage:', error)
      }
    }
  }, [filters, isHydrated, storageKey])

  // Unified debouncing: update debouncedFilters 300ms after filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [filters])

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

  const setRanScoreFilter = useCallback((ranScore: string) => {
    setFiltersState(prev => ({ ...prev, ranScoreFilter: ranScore }))
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

  const setCircleFilter = useCallback((circle: string) => {
    setFiltersState(prev => ({ ...prev, circleFilter: circle }))
  }, [])

  const setSiteCategoryFilter = useCallback((siteCategory: string) => {
    setFiltersState(prev => ({ ...prev, siteCategoryFilter: siteCategory }))
  }, [])

  const setYearFilter = useCallback((year: string) => {
    setFiltersState(prev => ({ ...prev, yearFilter: year }))
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
    debouncedFilters,
    
    // Actions
    setVendorFilter,
    setProgramFilter,
    setCityFilter,
    setNanoClusterFilter,
    setRanScoreFilter,
    setYearFilter,
    setSearchTerm,
    setStatusFilter,
    setRegionFilter,
    setCircleFilter,
    setSiteCategoryFilter,
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

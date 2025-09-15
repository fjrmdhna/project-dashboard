"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { Row } from '@/components/cards/MatrixStatsCard'

interface UseSiteDataOptions {
  initialFilter?: FilterValue
}

interface UseSiteDataReturn {
  rows: Row[]
  loading: boolean
  error: Error | null
  count: number
  refetch: () => Promise<void>
  filter: FilterValue
  updateFilter: (filter: FilterValue) => void
}

export function useSiteData(options: UseSiteDataOptions = {}): UseSiteDataReturn {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [count, setCount] = useState(0)
  const [filter, setFilter] = useState<FilterValue>(
    options.initialFilter || {
      q: '',
      vendor_name: [],
      program_report: [],
      imp_ttp: []
    }
  )
  
  // Ref untuk menyimpan timeout ID
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFetchingRef = useRef(false)

  // Fungsi untuk membangun URL dengan filter
  const buildUrl = useCallback((filter: FilterValue) => {
    const params = new URLSearchParams()
    if (filter.q) params.append('q', filter.q)
    filter.vendor_name.forEach(vendor => params.append('vendor_name', vendor))
    filter.program_report.forEach(program => params.append('program_report', program))
    filter.imp_ttp.forEach(city => params.append('imp_ttp', city))
    const qs = params.toString()
    return qs ? `/api/hermes-5g/site-data?${qs}` : '/api/hermes-5g/site-data'
  }, [])
  
  // Fungsi untuk fetch data dengan race condition protection
  const fetchData = useCallback(async (filter: FilterValue) => {
    // Set flag untuk mencegah multiple concurrent requests
    if (isFetchingRef.current) {
      console.log('Request already in progress, skipping...')
      return
    }
    
    isFetchingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const url = buildUrl(filter)
      console.log('Fetching data with filter:', filter)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setRows(data.data)
        setCount(data.count || 0)
        console.log('Data fetched successfully:', data.count, 'records')
      } else {
        throw new Error(data.message || 'Unknown error')
      }
    } catch (err) {
      console.error('Error fetching site data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [buildUrl])
  
  // Effect untuk fetch data saat filter berubah dengan debouncing
  useEffect(() => {
    // Clear timeout sebelumnya jika ada
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // Set timeout baru untuk debounce
    debounceTimeoutRef.current = setTimeout(() => {
      fetchData(filter)
    }, 300) // 300ms debounce delay
    
    // Cleanup function
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [filter, fetchData])
  
  // Fungsi untuk refetch data dengan filter saat ini
  const refetch = useCallback(async () => {
    await fetchData(filter)
  }, [filter, fetchData])
  
  // Fungsi untuk update filter dengan immediate update
  const updateFilter = useCallback((newFilter: FilterValue) => {
    console.log('Filter updated:', newFilter)
    setFilter(newFilter)
  }, [])
  
  // Cleanup timeout saat component unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])
  
  return {
    rows,
    loading,
    error,
    count,
    refetch,
    filter,
    updateFilter
  }
} 

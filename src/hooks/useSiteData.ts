"use client"

import { useState, useEffect, useMemo } from 'react'
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

  // Fungsi untuk membangun URL dengan filter
  const buildUrl = (filter: FilterValue) => {
    const url = new URL('/api/hermes-5g/site-data', window.location.origin)
    
    // Tambahkan query parameter
    if (filter.q) url.searchParams.append('q', filter.q)
    
    // Tambahkan multi-value parameters
    filter.vendor_name.forEach(vendor => {
      url.searchParams.append('vendor_name', vendor)
    })
    
    filter.program_report.forEach(program => {
      url.searchParams.append('program_report', program)
    })
    
    filter.imp_ttp.forEach(city => {
      url.searchParams.append('imp_ttp', city)
    })
    
    return url.toString()
  }
  
  // Fungsi untuk fetch data
  const fetchData = async (filter: FilterValue) => {
    setLoading(true)
    setError(null)
    
    try {
      const url = buildUrl(filter)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setRows(data.data)
        setCount(data.count || 0)
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
    }
  }
  
  // Effect untuk fetch data saat filter berubah
  useEffect(() => {
    fetchData(filter)
  }, [filter])
  
  // Fungsi untuk refetch data dengan filter saat ini
  const refetch = async () => {
    await fetchData(filter)
  }
  
  // Fungsi untuk update filter
  const updateFilter = (newFilter: FilterValue) => {
    setFilter(newFilter)
  }
  
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
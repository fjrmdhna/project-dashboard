"use client"

import { useState, useEffect, useCallback } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { format, subDays } from 'date-fns'

export interface DailyRunrateItem {
  date: string
  readiness: number
  activated: number
}

interface UseDailyRunrateDataOptions {
  filter?: FilterValue
}

interface UseDailyRunrateDataReturn {
  data: DailyRunrateItem[]
  loading: boolean
  error: Error | null
  refreshData: () => Promise<void>
}

export function useDailyRunrateData(options: UseDailyRunrateDataOptions = {}): UseDailyRunrateDataReturn {
  const [data, setData] = useState<DailyRunrateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const filter = options.filter || { q: '', vendor_name: [], program_report: [], imp_ttp: [] }

  // Fungsi untuk fetch data dari API
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Prepare filter parameters
      const params = new URLSearchParams()
      
      // Add search term
      if (filter.q) {
        params.append('searchFilter', filter.q)
      }
      
      // Add vendor filter
      if (filter.vendor_name && filter.vendor_name.length > 0) {
        params.append('vendorFilter', filter.vendor_name[0])
      } else {
        params.append('vendorFilter', 'all')
      }
      
      // Add program filter
      if (filter.program_report && filter.program_report.length > 0) {
        params.append('programFilter', filter.program_report[0])
      } else {
        params.append('programFilter', 'all')
      }
      
      // Add city filter
      if (filter.imp_ttp && filter.imp_ttp.length > 0) {
        params.append('cityFilter', filter.imp_ttp[0])
      } else {
        params.append('cityFilter', 'all')
      }

      const response = await fetch(`/api/hermes-5g/daily-runrate?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.status === 'success') {
        setData(result.data || [])
      } else {
        throw new Error(result.message || 'Unknown error')
      }
    } catch (err) {
      console.error('Error fetching daily runrate data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      
      // Generate fallback data in case of error
      const today = new Date()
      const fallbackData: DailyRunrateItem[] = Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(today, 6 - i), 'dd-MMM-yy'),
        readiness: 0,
        activated: 0
      }))
      setData(fallbackData)
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Fetch data ketika filter berubah
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Return data dan functions
  return {
    data,
    loading,
    error,
    refreshData: fetchData
  }
} 
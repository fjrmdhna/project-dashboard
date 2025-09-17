"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { format, subDays } from 'date-fns'
import { buildFilterParams } from '@/lib/filters'

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

  const filter = options.filter || { q: '', vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [] }

  // Fungsi untuk fetch data dari API
  const abortRef = useRef<AbortController | null>(null)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Prepare consistent filter params
      const params = buildFilterParams(filter)

      // Abort previous ongoing request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(`/api/hermes-5g/daily-runrate?${params.toString()}` , { signal: controller.signal })
      
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
      // Ignore user-triggered aborts from rapid filter changes
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
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

  // Fetch data ketika filter berubah (debounced)
  useEffect(() => {
    const t = setTimeout(() => { fetchData() }, 300)
    return () => {
      clearTimeout(t)
      abortRef.current?.abort()
    }
  }, [fetchData])

  // Return data dan functions
  return {
    data,
    loading,
    error,
    refreshData: fetchData
  }
} 

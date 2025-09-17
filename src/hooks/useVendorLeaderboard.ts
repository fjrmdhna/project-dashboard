"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { buildFilterParams } from '@/lib/filters'

export interface VendorScore {
  vendorName: string
  totalSites: number
  readinessCount: number
  activatedCount: number
  forecastCount: number
  readinessVsForecast: number
  activatedVsForecast: number
  aboveAccelerationActivated: number
  firstTimeRight: number
  totalScore: number
  rank: number
}

interface UseVendorLeaderboardOptions {
  filter?: FilterValue
}

interface UseVendorLeaderboardReturn {
  data: VendorScore[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  totalVendors: number
}

export function useVendorLeaderboard(options: UseVendorLeaderboardOptions = {}): UseVendorLeaderboardReturn {
  const [data, setData] = useState<VendorScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [totalVendors, setTotalVendors] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const filter = options.filter || {
        q: '',
        vendor_name: [],
        program_report: [],
        imp_ttp: [],
        nano_cluster: []
      }

      // Build URL with consistent filter parameters
      const params = buildFilterParams(filter)
      const url = `/api/hermes-5g/vendor-leaderboard?${params.toString()}`

      // Abort any inflight request before starting a new one
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(url, { signal: controller.signal })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.status === 'success') {
        setData(result.data)
        setTotalVendors(result.totalVendors || 0)
      } else {
        throw new Error(result.message || 'Failed to fetch vendor leaderboard data')
      }
    } catch (err) {
      // Ignore user-triggered aborts from rapid filter changes
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLoading(false)
        return
      }
      console.error('Error fetching vendor leaderboard data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setData([])
      setTotalVendors(0)
    } finally {
      setLoading(false)
    }
  }, [options.filter])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    const t = setTimeout(() => { fetchData() }, 300)
    return () => {
      clearTimeout(t)
      abortRef.current?.abort()
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch,
    totalVendors
  }
}

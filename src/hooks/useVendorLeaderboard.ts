"use client"

import { useState, useEffect, useCallback } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'

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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const filter = options.filter || {
        q: '',
        vendor_name: [],
        program_report: [],
        imp_ttp: []
      }

      // Build URL with filter parameters
      const url = new URL('/api/hermes-5g/vendor-leaderboard', window.location.origin)
      
      // Add query parameters
      if (filter.q) url.searchParams.append('q', filter.q)
      
      // Add multi-value parameters
      filter.vendor_name.forEach(vendor => {
        url.searchParams.append('vendor_name', vendor)
      })
      
      filter.program_report.forEach(program => {
        url.searchParams.append('program_report', program)
      })
      
      filter.imp_ttp.forEach(city => {
        url.searchParams.append('imp_ttp', city)
      })

      const response = await fetch(url.toString())
      
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
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch,
    totalVendors
  }
}
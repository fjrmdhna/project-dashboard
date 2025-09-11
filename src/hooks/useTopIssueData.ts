"use client"

import { useState, useEffect, useCallback } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'

export interface TopIssue {
  category: string
  count: number
  color: string
}

interface UseTopIssueDataOptions {
  filter?: FilterValue
}

interface UseTopIssueDataReturn {
  data: TopIssue[]
  loading: boolean
  error: Error | null
  topIssuesTotal: number
  totalIssues: number
  refreshData: () => Promise<void>
}

export function useTopIssueData(options: UseTopIssueDataOptions = {}): UseTopIssueDataReturn {
  const [data, setData] = useState<TopIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [topIssuesTotal, setTopIssuesTotal] = useState(0)
  const [totalIssues, setTotalIssues] = useState(0)

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

      const response = await fetch(`/api/hermes-5g/top-5-issue?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.status === 'success') {
        setData(result.data || [])
        setTopIssuesTotal(result.top5Count || 0)
        setTotalIssues(result.totalCount || 0)
      } else {
        throw new Error(result.message || 'Unknown error')
      }
    } catch (err) {
      console.error('Error fetching top issue data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setData([])
      setTopIssuesTotal(0)
      setTotalIssues(0)
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
    topIssuesTotal,
    totalIssues,
    refreshData: fetchData
  }
} 
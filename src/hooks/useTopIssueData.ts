"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { FilterValue } from '@/components/filters/FilterBar'
import { buildFilterParams } from '@/lib/filters'

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

  const filter = options.filter || { q: '', vendor_name: [], program_report: [], imp_ttp: [], nano_cluster: [] }

  // Fungsi untuk fetch data dari API
  const abortRef = useRef<AbortController | null>(null)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Build consistent filter params (supports multi-value)
      const params = buildFilterParams(filter)

      // Abort previous request if any
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(`/api/hermes-5g/top-5-issue?${params.toString()}` , { signal: controller.signal })
      
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
      // Ignore aborted requests to avoid noisy errors when rapidly changing filters
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      console.error('Error fetching top issue data:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setData([])
      setTopIssuesTotal(0)
      setTotalIssues(0)
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
    topIssuesTotal,
    totalIssues,
    refreshData: fetchData
  }
} 

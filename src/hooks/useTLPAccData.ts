"use client"

import { useMemo, useCallback } from 'react'
import { useApiCache } from '@/hooks/useApiCache'
import { fetchWithRetry } from '@/lib/api-utils'
import type { SiteDataTLP } from '@/lib/supabase'
import type { FilterValue } from '@/components/filters/FilterBar'

interface UseTLPAccDataOptions {
  filter?: FilterValue
}

interface AccDataPoint {
  month: string // Format: "Jan-25"
  planRfiAcc: number // Cumulative count from ic_000010_ff
  actualRfiAcc: number // Cumulative count from ic_000010_af
  actualCrfiAcc: number // Cumulative count from rfi_accepted
}

interface UseTLPAccDataReturn {
  data: AccDataPoint[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Helper function to parse date and get month key
const getMonthKey = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    
    const month = date.toLocaleString('en', { month: 'short' })
    const year = date.getFullYear().toString().slice(-2)
    return `${month}-${year}`
  } catch {
    return null
  }
}

// Helper function to aggregate data by month
const aggregateByMonth = (rows: SiteDataTLP[]): AccDataPoint[] => {
  // Get all unique months from the data
  const monthSet = new Set<string>()
  
  rows.forEach(row => {
    const monthFF = getMonthKey(row.ic_000010_ff)
    const monthAF = getMonthKey(row.ic_000010_af)
    const monthRFI = getMonthKey(row.rfi_accepted)
    
    if (monthFF) monthSet.add(monthFF)
    if (monthAF) monthSet.add(monthAF)
    if (monthRFI) monthSet.add(monthRFI)
  })
  
  // Generate months from Jan-25 to Feb-26 (based on image description)
  const allMonths: string[] = []
  for (let year = 2025; year <= 2026; year++) {
    const startMonth = year === 2025 ? 0 : 0 // Jan
    const endMonth = year === 2026 ? 1 : 11 // Feb for 2026, Dec for 2025
    
    for (let month = startMonth; month <= endMonth; month++) {
      const date = new Date(year, month, 1)
      const monthKey = getMonthKey(date.toISOString())
      if (monthKey) {
        allMonths.push(monthKey)
        monthSet.add(monthKey)
      }
    }
  }
  
  // Sort months chronologically
  const sortedMonths = Array.from(monthSet).sort((a, b) => {
    const parseMonth = (m: string) => {
      const [monthStr, yearStr] = m.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames.indexOf(monthStr)
      const year = parseInt('20' + yearStr)
      return new Date(year, month, 1).getTime()
    }
    return parseMonth(a) - parseMonth(b)
  })
  
  // Calculate cumulative counts for each month
  // For cumulative, we need to count all entries up to and including the current month
  const result: AccDataPoint[] = []
  
  sortedMonths.forEach((month, index) => {
    // Parse current month to get date
    const parseMonth = (m: string) => {
      const [monthStr, yearStr] = m.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthIndex = monthNames.indexOf(monthStr)
      const year = parseInt('20' + yearStr)
      return new Date(year, monthIndex, 1)
    }
    
    const currentMonthDate = parseMonth(month)
    const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999)
    
    // Count all entries up to and including this month (cumulative)
    const cumulativePlanRfi = rows.filter(row => {
      if (!row.ic_000010_ff) return false
      const rowDate = new Date(row.ic_000010_ff)
      return !isNaN(rowDate.getTime()) && rowDate <= endOfMonth
    }).length
    
    const cumulativeActualRfi = rows.filter(row => {
      if (!row.ic_000010_af) return false
      const rowDate = new Date(row.ic_000010_af)
      return !isNaN(rowDate.getTime()) && rowDate <= endOfMonth
    }).length
    
    const cumulativeActualCrfi = rows.filter(row => {
      if (!row.rfi_accepted) return false
      const rowDate = new Date(row.rfi_accepted)
      return !isNaN(rowDate.getTime()) && rowDate <= endOfMonth
    }).length
    
    result.push({
      month,
      planRfiAcc: cumulativePlanRfi,
      actualRfiAcc: cumulativeActualRfi,
      actualCrfiAcc: cumulativeActualCrfi
    })
  })
  
  // Add "Proposed Return" and "Return" points (using last values)
  if (result.length > 0) {
    const lastPoint = result[result.length - 1]
    result.push({
      month: 'Proposed Return',
      planRfiAcc: lastPoint.planRfiAcc,
      actualRfiAcc: lastPoint.actualRfiAcc,
      actualCrfiAcc: lastPoint.actualCrfiAcc
    })
    result.push({
      month: 'Return',
      planRfiAcc: lastPoint.planRfiAcc,
      actualRfiAcc: lastPoint.actualRfiAcc,
      actualCrfiAcc: lastPoint.actualCrfiAcc
    })
  }
  
  return result
}

export function useTLPAccData(options: UseTLPAccDataOptions = {}): UseTLPAccDataReturn {
  const { filter } = options
  
  // Build cache key from filter
  const cacheKey = useMemo(() => {
    return `tlp-acc-data-${JSON.stringify(filter || {})}`
  }, [filter])
  
  // Build URL with filters
  const buildUrl = useCallback((filter: FilterValue | undefined) => {
    const params = new URLSearchParams()
    if (filter?.q) params.append('q', filter.q)
    if (filter?.vendor_name) {
      filter.vendor_name.forEach(vendor => params.append('vendor_code', vendor))
    }
    if (filter?.program_report) {
      filter.program_report.forEach(program => params.append('program_name', program))
    }
    if (filter?.imp_ttp) {
      filter.imp_ttp.forEach(region => params.append('region', region))
    }
    const qs = params.toString()
    return qs ? `/api/tlp/acc-data?${qs}` : '/api/tlp/acc-data'
  }, [])
  
  // Fetch function
  const fetchFn = useCallback(async () => {
    const url = buildUrl(filter)
    const response = await fetchWithRetry(url, {}, 3)
    
    const result = await response.json()
    
    if (result.status === 'success') {
      const rows = result.data || []
      const aggregated = aggregateByMonth(rows)
      return aggregated
    } else {
      throw new Error(result.message || 'Unknown error')
    }
  }, [filter, buildUrl])
  
  // Use useApiCache
  const { data, loading, error, refetch: cacheRefetch } = useApiCache<AccDataPoint[]>(
    cacheKey,
    fetchFn,
    {
      staleTime: 2 * 60 * 1000, // 2 menit
      cacheTime: 5 * 60 * 1000, // 5 menit
      refetchOnMount: true,
      validateFn: (data) => {
        return Array.isArray(data)
      }
    }
  )
  
  // Refetch function
  const refetch = useCallback(async () => {
    await cacheRefetch()
  }, [cacheRefetch])
  
  return {
    data: data || [],
    loading,
    error: error || null,
    refetch
  }
}


import { useState, useEffect, useCallback } from 'react'
import { VendorMetrics } from '@/types/leaderboard'
import { getCurrentWeek } from '@/lib/leaderboard-utils'

interface UseVendorLeaderboardReturn {
  vendors: VendorMetrics[]
  loading: boolean
  error: string | null
  week: number
  year: number
  stats: any
  refetch: () => void
  updateFTR: (data: any[]) => Promise<void>
  setWeek: (week: number) => void
  setYear: (year: number) => void
}

export function useVendorLeaderboard(): UseVendorLeaderboardReturn {
  const [vendors, setVendors] = useState<VendorMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState(null)
  
  const { week: currentWeek, year: currentYear } = getCurrentWeek()
  const [week, setWeek] = useState(currentWeek)
  const [year, setYear] = useState(currentYear)

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        week: week.toString(),
        year: year.toString()
      })
      
      const response = await fetch(`/api/vendor-leaderboard?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setVendors(result.data.vendors)
        setStats(result.data.stats)
      } else {
        setError(result.error || 'Failed to fetch leaderboard data')
        setVendors([])
        setStats(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setVendors([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [week, year])

  // Update FTR data
  const updateFTR = useCallback(async (ftrData: any[]) => {
    try {
      const response = await fetch('/api/vendor-leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ftr_data: ftrData,
          week: week,
          year: year
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Refresh leaderboard after FTR update
        await fetchLeaderboard()
      } else {
        throw new Error(result.error || 'Failed to save FTR data')
      }
    } catch (err) {
      console.error('Error updating FTR data:', err)
      throw err
    }
  }, [week, year, fetchLeaderboard])

  // Refetch function
  const refetch = useCallback(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Fetch data when week/year changes
  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return {
    vendors,
    loading,
    error,
    week,
    year,
    stats,
    refetch,
    updateFTR,
    setWeek,
    setYear
  }
} 
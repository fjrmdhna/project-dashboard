import { useState, useEffect, useCallback } from 'react'
import { useApiCache } from './useApiCache'

interface ChartFilters {
  vendorFilter: string
  programFilter: string
  cityFilter: string
  searchFilter?: string
}

interface ChartData {
  readinessChartData: any[]
  activatedChartData: any[]
  progressCurveData: any[]
  dailyRunrateData: any[]
  dataAlignmentData: any | null
  top5IssueData: any[]
  top5IssueStats: { top5Count: number; totalCount: number }
  nanoClusterData: any | null
}

interface UseHermes5GChartsReturn {
  // Chart data
  chartData: ChartData
  
  // Loading states
  loading: {
    readiness: boolean
    activated: boolean
    progressCurve: boolean
    dailyRunrate: boolean
    dataAlignment: boolean
    top5Issue: boolean
    nanoCluster: boolean
  }
  
  // Actions
  refreshAllCharts: () => void
  refreshChart: (chartName: keyof ChartData) => void
}

export function useHermes5GCharts(filters: ChartFilters): UseHermes5GChartsReturn {
  // Chart data state
  const [chartData, setChartData] = useState<ChartData>({
    readinessChartData: [],
    activatedChartData: [],
    progressCurveData: [],
    dailyRunrateData: [],
    dataAlignmentData: null,
    top5IssueData: [],
    top5IssueStats: { top5Count: 0, totalCount: 0 },
    nanoClusterData: null
  })

  // Loading states
  const [loading, setLoading] = useState({
    readiness: false,
    activated: false,
    progressCurve: false,
    dailyRunrate: false,
    dataAlignment: false,
    top5Issue: false,
    nanoCluster: false
  })

  // Fetch readiness chart data
  const fetchReadinessChartData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, readiness: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/readiness-chart?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ ...prev, readinessChartData: result.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching readiness chart data:', error)
    } finally {
      setLoading(prev => ({ ...prev, readiness: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch activated chart data
  const fetchActivatedChartData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, activated: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/activated-chart?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ ...prev, activatedChartData: result.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching activated chart data:', error)
    } finally {
      setLoading(prev => ({ ...prev, activated: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch progress curve data
  const fetchProgressCurveData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, progressCurve: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/progress-curve?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ ...prev, progressCurveData: result.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching progress curve data:', error)
    } finally {
      setLoading(prev => ({ ...prev, progressCurve: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch daily runrate data
  const fetchDailyRunrateData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, dailyRunrate: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/daily-runrate?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ ...prev, dailyRunrateData: result.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching daily runrate data:', error)
    } finally {
      setLoading(prev => ({ ...prev, dailyRunrate: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch data alignment data
  const fetchDataAlignmentData = useCallback(async () => {
    setLoading(prev => ({ ...prev, dataAlignment: true }))
    try {
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/data-alignment?${params}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        // Validate and sanitize data
        const safeData = {
          totalSites: Number(result.data.totalSites) || 0,
          alignedSites: Number(result.data.alignedSites) || 0,
          misalignedSites: Number(result.data.misalignedSites) || 0,
          alignmentRate: Number(result.data.alignmentRate) || 0,
          trends: {
            total: Number(result.data.trends?.total) || 0,
            aligned: Number(result.data.trends?.aligned) || 0,
            misaligned: Number(result.data.trends?.misaligned) || 0
          }
        }
        setChartData(prev => ({ ...prev, dataAlignmentData: safeData }))
      } else {
        // Set safe default data
        setChartData(prev => ({ 
          ...prev, 
          dataAlignmentData: {
            totalSites: 0,
            alignedSites: 0,
            misalignedSites: 0,
            alignmentRate: 0,
            trends: { total: 0, aligned: 0, misaligned: 0 }
          }
        }))
      }
    } catch (error) {
      console.error('Error fetching data alignment:', error)
      // Set safe default data on error
      setChartData(prev => ({ 
        ...prev, 
        dataAlignmentData: {
          totalSites: 0,
          alignedSites: 0,
          misalignedSites: 0,
          alignmentRate: 0,
          trends: { total: 0, aligned: 0, misaligned: 0 }
        }
      }))
    } finally {
      setLoading(prev => ({ ...prev, dataAlignment: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch top 5 issue data
  const fetchTop5IssueData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, top5Issue: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/top-5-issue?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ 
            ...prev, 
            top5IssueData: result.data,
            top5IssueStats: {
              top5Count: result.top5Count,
              totalCount: result.totalCount
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching top 5 issue data:', error)
    } finally {
      setLoading(prev => ({ ...prev, top5Issue: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Fetch nano cluster data
  const fetchNanoClusterData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, nanoCluster: true }))
      
      const params = new URLSearchParams({
        vendorFilter: filters.vendorFilter,
        programFilter: filters.programFilter,
        cityFilter: filters.cityFilter,
        searchFilter: filters.searchFilter || ''
      })
      
      const response = await fetch(`/api/hermes-5g/nano-cluster?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setChartData(prev => ({ ...prev, nanoClusterData: result.data }))
        }
      }
    } catch (error) {
      console.error('Error fetching nano cluster data:', error)
    } finally {
      setLoading(prev => ({ ...prev, nanoCluster: false }))
    }
  }, [filters.vendorFilter, filters.programFilter, filters.cityFilter, filters.searchFilter])

  // Refresh all charts
  const refreshAllCharts = useCallback(async () => {
    await Promise.all([
      fetchReadinessChartData(),
      fetchActivatedChartData(),
      fetchProgressCurveData(),
      fetchDailyRunrateData(),
      fetchDataAlignmentData(),
      fetchTop5IssueData(),
      fetchNanoClusterData()
    ])
  }, [
    fetchReadinessChartData,
    fetchActivatedChartData,
    fetchProgressCurveData,
    fetchDailyRunrateData,
    fetchDataAlignmentData,
    fetchTop5IssueData,
    fetchNanoClusterData
  ])

  // Refresh specific chart
  const refreshChart = useCallback(async (chartName: keyof ChartData) => {
    switch (chartName) {
      case 'readinessChartData':
        await fetchReadinessChartData()
        break
      case 'activatedChartData':
        await fetchActivatedChartData()
        break
      case 'progressCurveData':
        await fetchProgressCurveData()
        break
      case 'dailyRunrateData':
        await fetchDailyRunrateData()
        break
      case 'dataAlignmentData':
        await fetchDataAlignmentData()
        break
      case 'top5IssueData':
        await fetchTop5IssueData()
        break
      case 'nanoClusterData':
        await fetchNanoClusterData()
        break
    }
  }, [
    fetchReadinessChartData,
    fetchActivatedChartData,
    fetchProgressCurveData,
    fetchDailyRunrateData,
    fetchDataAlignmentData,
    fetchTop5IssueData,
    fetchNanoClusterData
  ])

  // Auto-fetch when filters change
  useEffect(() => {
    refreshAllCharts()
  }, [refreshAllCharts])

  return {
    chartData,
    loading,
    refreshAllCharts,
    refreshChart
  }
} 
import { useState, useEffect, useCallback } from 'react'

interface SiteData5G {
  system_key: string
  site_id: string
  site_name: string
  vendor_name: string
  site_status: string
  region: string
  year: string
  program_name: string
  "SBOQ.project_type": string
  vendor_code: string
  "5g_readiness_date": string | null
  "5g_activation_date": string | null
  cx_acceptance_status: string
  long: number | null
  lat: number | null
  created_at: string
  site_category?: string
  scope_of_work?: string
  region_wise?: string
  region_circle?: string
}

interface PaginationInfo {
  currentPage: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface StatsData {
  total: number
  scope: number
  caf: number
  mos: number
  installation: number
  fiveGReadiness: number
  fiveGActivation: number
  rfc: number
  endorse: number
  hotnews: number
  pac: number
  clusterAtp: number
}

interface TableFilters {
  search: string
  status: string
  region: string
  vendor: string
}

interface UseHermes5GSiteDataReturn {
  // Data
  sites: SiteData5G[]
  pagination: PaginationInfo | null
  stats: StatsData | null
  totalRecords: number
  
  // Loading state
  loading: boolean
  
  // Pagination
  currentPage: number
  pageSize: number
  
  // Actions
  fetchSiteData: (page?: number, filters?: TableFilters) => void
  handlePageChange: (page: number) => void
  refreshData: () => void
  setCurrentPage: (page: number) => void // Add this
}

export function useHermes5GSiteData(): UseHermes5GSiteDataReturn {
  const [sites, setSites] = useState<SiteData5G[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)

  const fetchSiteData = useCallback(async (
    page: number = 1, 
    filters: TableFilters = { search: '', status: 'all', region: 'all', vendor: 'all' }
  ) => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: filters.search,
        status: filters.status,
        regionFilter: filters.region,
        vendorFilter: filters.vendor
      })
      
      const response = await fetch(`/api/hermes-5g?${params}`)
      if (response.ok) {
        const result = await response.json()
        setSites(result.data)
        setPagination(result.pagination)
        setStats(result.stats)
        setTotalRecords(result.pagination.totalRecords)
        setCurrentPage(page)
      } else {
        console.error('Failed to fetch data:', response.statusText)
        setSites([])
        setPagination(null)
        setStats(null)
        setTotalRecords(0)
      }
    } catch (error) {
      console.error("Error fetching site data:", error)
      setSites([])
      setPagination(null)
      setStats(null)
      setTotalRecords(0)
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    // Note: filters will be passed from parent component
  }, [])

  const refreshData = useCallback(() => {
    fetchSiteData(currentPage)
  }, [fetchSiteData, currentPage])

  // Initial fetch
  useEffect(() => {
    fetchSiteData()
  }, [fetchSiteData])

  return {
    sites,
    pagination,
    stats,
    totalRecords,
    loading,
    currentPage,
    pageSize,
    fetchSiteData,
    handlePageChange,
    refreshData,
    setCurrentPage // Add this
  }
} 
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Filter,
  Eye,
  EyeOff,
  MapPin,
  Building2,
  Calendar,
  Signal,
  CheckCircle,
  TrendingUp,
  Loader2
} from "lucide-react"
import { useHermes5GContext } from '@/contexts/Hermes5GContext'
import { ColumnManager } from './ColumnManager'

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

interface Column {
  key: keyof SiteData5G | string
  label: string
  sortable: boolean
  visible: boolean
  width?: string
  render?: (value: any, row: SiteData5G) => React.ReactNode
}

interface SortConfig {
  key: keyof SiteData5G | string
  direction: 'asc' | 'desc'
}

export function Hermes5GDataTable() {
  const {
    sites,
    pagination,
    siteLoading,
    currentPage,
    pageSize,
    handlePageChange,
    fetchSiteData,
    tableFilters
  } = useHermes5GContext()

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'site_id', 'site_name', 'vendor_name', 'site_status', 'region', 
    'program_name', '5g_readiness_date', '5g_activation_date', 'cx_acceptance_status'
  ]))

  // Define columns with essential flag
  const allColumns: (Column & { essential?: boolean })[] = [
    {
      key: 'site_id',
      label: 'Site ID',
      sortable: true,
      visible: true,
      essential: true,
      width: '120px',
      render: (value) => (
        <div className="font-mono text-sm font-medium">{value}</div>
      )
    },
    {
      key: 'site_name',
      label: 'Site Name',
      sortable: true,
      visible: true,
      width: '200px',
      render: (value) => (
        <div className="font-medium text-sm">{value}</div>
      )
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      sortable: true,
      visible: true,
      width: '120px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      )
    },
    {
      key: 'site_status',
      label: 'Status',
      sortable: true,
      visible: true,
      width: '140px',
      render: (value) => (
        <Badge className={getStatusColor(value)}>
          {value}
        </Badge>
      )
    },
    {
      key: 'region',
      label: 'Region',
      sortable: true,
      visible: true,
      width: '100px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      )
    },
    {
      key: 'program_name',
      label: 'Program',
      sortable: true,
      visible: true,
      width: '150px',
      render: (value) => (
        <div className="text-sm">{value}</div>
      )
    },
    {
      key: 'SBOQ.project_type',
      label: 'Project Type',
      sortable: true,
      visible: false,
      width: '140px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      )
    },
    {
      key: 'year',
      label: 'Year',
      sortable: true,
      visible: false,
      width: '80px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      )
    },
    {
      key: '5g_readiness_date',
      label: '5G Readiness',
      sortable: true,
      visible: true,
      width: '140px',
      render: (value) => {
        if (!value) return <span className="text-muted-foreground text-sm">-</span>
        return (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{new Date(value).toLocaleDateString()}</span>
          </div>
        )
      }
    },
    {
      key: '5g_activation_date',
      label: '5G Activation',
      sortable: true,
      visible: true,
      width: '140px',
      render: (value) => {
        if (!value) return <span className="text-muted-foreground text-sm">-</span>
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600">{new Date(value).toLocaleDateString()}</span>
          </div>
        )
      }
    },
    {
      key: 'cx_acceptance_status',
      label: 'CX Status',
      sortable: true,
      visible: true,
      width: '140px',
      render: (value) => (
        <Badge className={getAcceptanceStatusColor(value)}>
          {value}
        </Badge>
      )
    }
  ]

  // Filter visible columns
  const activeColumns = allColumns.filter(col => visibleColumns.has(col.key as string))

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return sites

    return [...sites].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof SiteData5G]
      const bVal = b[sortConfig.key as keyof SiteData5G]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [sites, sortConfig])

  // Handle sorting
  const handleSort = (key: keyof SiteData5G | string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else {
          return null // Remove sort
        }
      }
      return { key, direction: 'asc' }
    })
  }

  // Get sort icon
  const getSortIcon = (key: keyof SiteData5G | string) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />
  }

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Reset columns to default
  const resetColumns = () => {
    setVisibleColumns(new Set([
      'site_id', 'site_name', 'vendor_name', 'site_status', 'region', 
      'program_name', '5g_readiness_date', '5g_activation_date', 'cx_acceptance_status'
    ]))
  }

  // Pagination controls
  const totalPages = pagination?.totalPages || 1
  const startRecord = pagination ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 0
  const endRecord = pagination ? Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords) : 0
  const totalRecords = pagination?.totalRecords || 0

  // Utility functions
  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case "12. on air":
        return "bg-green-100 text-green-800 border-green-200"
      case "00d. hold":
        return "bg-red-100 text-red-800 border-red-200"
      case "07. rfi":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "08. crfi":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "09. mos":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "10. installation":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "11. integration":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  function getAcceptanceStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "in review":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (siteLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Data</CardTitle>
          <CardDescription>Detailed site information and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading site data...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Site Data</CardTitle>
            <CardDescription>
              Detailed site information and status ({totalRecords.toLocaleString()} total sites)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Column Visibility */}
            <ColumnManager
              columns={allColumns.map(col => ({ 
                key: col.key as string, 
                label: col.label, 
                visible: col.visible,
                essential: col.essential 
              }))}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetColumns={resetColumns}
            />
            
            {/* Export Button */}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Table */}
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                {activeColumns.map((column: Column & { essential?: boolean }) => (
                  <th
                    key={column.key as string}
                    className="text-left p-4 font-medium text-sm"
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort(column.key)}
                      >
                        <span className="mr-2">{column.label}</span>
                        {getSortIcon(column.key)}
                      </Button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {sortedData.map((site, index) => (
                <tr 
                  key={site.system_key} 
                  className={`border-b hover:bg-muted/50 transition-colors ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  }`}
                >
                  {activeColumns.map((column: Column & { essential?: boolean }) => (
                    <td key={column.key as string} className="p-4">
                      {column.render 
                        ? column.render(site[column.key as keyof SiteData5G], site)
                        : site[column.key as keyof SiteData5G]
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {sortedData.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground">No sites found matching your criteria</div>
          </div>
        )}

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Showing {startRecord.toLocaleString()} to {endRecord.toLocaleString()} of {totalRecords.toLocaleString()} results
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-8 h-8"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
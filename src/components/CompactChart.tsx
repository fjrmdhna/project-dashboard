"use client"

import { memo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CompactChartProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  height?: string
  loading?: boolean
}

const CompactChart = memo(function CompactChart({ 
  title, 
  icon, 
  children, 
  height = "h-[120px]",
  loading = false 
}: CompactChartProps) {
  if (loading) {
    return (
      <Card className={`bg-slate-800 border-slate-700 ${height} overflow-hidden`}>
        <CardHeader className="pb-1 px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            {icon}
            <CardTitle className="text-xs font-bold text-white truncate">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-2 flex items-center justify-center flex-1 overflow-hidden">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-400 text-xs">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-slate-800 border-slate-700 ${height} overflow-hidden flex flex-col`}>
      <CardHeader className="pb-1 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          {icon}
          <CardTitle className="text-xs font-bold text-white truncate">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2 flex flex-col justify-center flex-1 overflow-hidden min-h-0">
        {children}
      </CardContent>
    </Card>
  )
})

export { CompactChart } 
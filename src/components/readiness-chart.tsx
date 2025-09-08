"use client"

import { useState, useEffect, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Signal } from 'lucide-react'

interface ReadinessChartData {
  location: string
  nyReadiness: number
  readiness: number
}

interface ReadinessChartProps {
  data: ReadinessChartData[]
}

const ReadinessChart = memo(function ReadinessChart({ data }: ReadinessChartProps) {
  // Early return for empty data
  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-purple-400" />
            <CardTitle className="text-sm font-bold text-white">5G READINESS</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 flex items-center justify-center h-32">
          <div className="text-slate-400 text-xs">No data available</div>
        </CardContent>
      </Card>
    )
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...data.map(item => Math.max(item.nyReadiness, item.readiness)),
    1
  )

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4 text-purple-400" />
          <CardTitle className="text-sm font-bold text-white">5G READINESS</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="p-3">
        <div className="space-y-3">
          {data.map((item, index) => {
            const notReadyWidth = ((maxValue - item.readiness) / maxValue) * 100
            const readyWidth = (item.readiness / maxValue) * 100
            
            return (
              <div key={index} className="space-y-1">
                {/* Location & Values */}
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium text-xs">
                    {item.location.toUpperCase()}
                  </span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-400">{maxValue - item.readiness}</span>
                    <span className="text-purple-300">{item.readiness}</span>
                  </div>
                </div>
                
                {/* Horizontal Bar Chart */}
                <div className="relative">
                  {/* Center line */}
                  <div className="absolute left-1/2 top-0 w-px h-6 bg-slate-600 z-10"></div>
                  
                  {/* Progress bars */}
                  <div className="flex h-6">
                    {/* Left side - Not Ready (goes left from center) */}
                    <div className="flex-1 flex justify-end pr-px">
                      <div 
                        className="bg-gradient-to-l from-red-500 to-red-600 h-full rounded-l-sm"
                        style={{ width: `${notReadyWidth}%` }}
                      />
                    </div>
                    
                    {/* Right side - Ready (goes right from center) */}
                    <div className="flex-1 flex pl-px">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-r-sm"
                        style={{ width: `${readyWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center space-x-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
            <span className="text-gray-400">Not Ready</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
            <span className="text-gray-400">Ready</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ReadinessChart.displayName = 'ReadinessChart'

export { ReadinessChart } 
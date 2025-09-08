"use client"

import { useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radio } from 'lucide-react'

interface ActivatedChartData {
  location: string
  nyActivated: number
  activated: number
}

interface ActivatedChartProps {
  data: ActivatedChartData[]
}

const ActivatedChart = memo(function ActivatedChart({ data }: ActivatedChartProps) {
  // Early return for empty data
  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-400" />
            <CardTitle className="text-sm font-bold text-white">5G ACTIVATED</CardTitle>
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
    ...data.map(item => Math.max(item.nyActivated, item.activated)),
    1
  )

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-green-400" />
          <CardTitle className="text-sm font-bold text-white">5G ACTIVATED</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="p-3">
        <div className="space-y-3">
          {data.map((item, index) => {
            const notActivatedWidth = ((maxValue - item.activated) / maxValue) * 100
            const activatedWidth = (item.activated / maxValue) * 100
            
            return (
              <div key={index} className="space-y-1">
                {/* Location & Values */}
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium text-xs">
                    {item.location.toUpperCase()}
                  </span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-400">{maxValue - item.activated}</span>
                    <span className="text-green-300">{item.activated}</span>
                  </div>
                </div>
                
                {/* Horizontal Bar Chart */}
                <div className="relative">
                  {/* Center line */}
                  <div className="absolute left-1/2 top-0 w-px h-6 bg-slate-600 z-10"></div>
                  
                  {/* Progress bars */}
                  <div className="flex h-6">
                    {/* Left side - Not Activated (goes left from center) */}
                    <div className="flex-1 flex justify-end pr-px">
                      <div 
                        className="bg-gradient-to-l from-orange-500 to-orange-600 h-full rounded-l-sm"
                        style={{ width: `${notActivatedWidth}%` }}
                      />
                    </div>
                    
                    {/* Right side - Activated (goes right from center) */}
                    <div className="flex-1 flex pl-px">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-r-sm"
                        style={{ width: `${activatedWidth}%` }}
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
            <div className="w-2 h-2 bg-orange-500 rounded-sm"></div>
            <span className="text-gray-400">Not Activated</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
            <span className="text-gray-400">Activated</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ActivatedChart.displayName = 'ActivatedChart'

export { ActivatedChart } 
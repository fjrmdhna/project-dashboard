"use client"

import { memo } from 'react'
import { BarChart3 } from 'lucide-react'
import { CompactChart } from './CompactChart'

interface DailyRunrateData {
  date: string
  readiness: number
  activated: number
  target: number
}

interface CompactDailyRunrateProps {
  data: DailyRunrateData[]
}

const CompactDailyRunrate = memo(function CompactDailyRunrate({ data }: CompactDailyRunrateProps) {
  if (!data || data.length === 0) {
    return (
      <CompactChart
        title="DAILY RUNRATE"
        icon={<BarChart3 className="h-3 w-3 text-orange-400" />}
        loading={true}
      >
        <div></div>
      </CompactChart>
    )
  }

  const maxValue = Math.max(
    ...data.flatMap(item => [item.readiness, item.activated, item.target]),
    1
  )

  return (
    <CompactChart
      title="DAILY RUNRATE"
      icon={<BarChart3 className="h-3 w-3 text-orange-400" />}
    >
      <div className="p-2 h-full flex flex-col overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 flex items-end justify-center px-1 overflow-hidden">
          <div className="flex items-end justify-center space-x-2 w-full max-w-[180px]">
            {data.slice(-7).map((item, index) => {
              const readinessHeight = Math.max((item.readiness / maxValue) * 50, 3)
              const activatedHeight = Math.max((item.activated / maxValue) * 50, 3)
              
              return (
                <div key={index} className="flex flex-col items-center space-y-1 flex-1 overflow-hidden">
                  {/* Bars Container */}
                  <div className="flex items-end justify-center space-x-0.5 h-14">
                    <div 
                      className="w-1.5 bg-purple-500 rounded-t-sm transition-all duration-300"
                      style={{ height: `${readinessHeight}px` }}
                      title={`Readiness: ${item.readiness}`}
                    />
                    <div 
                      className="w-1.5 bg-green-500 rounded-t-sm transition-all duration-300"
                      style={{ height: `${activatedHeight}px` }}
                      title={`Activated: ${item.activated}`}
                    />
                  </div>
                  
                  {/* Date Label */}
                  <div className="text-[7px] text-gray-400 font-medium whitespace-nowrap">
                    {new Date(item.date).getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center items-center space-x-2 mt-1 pt-1 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
            <span className="text-gray-300 text-[8px] font-medium">Readiness</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
            <span className="text-gray-300 text-[8px] font-medium">Activated</span>
          </div>
        </div>
      </div>
    </CompactChart>
  )
})

export { CompactDailyRunrate } 
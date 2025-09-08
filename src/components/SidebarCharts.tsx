"use client"

import { memo } from 'react'
import { Signal, Radio } from 'lucide-react'

interface ChartData {
  location: string
  nyValue: number
  currentValue: number
}

interface SidebarChartsProps {
  readinessData: ChartData[]
  activatedData: ChartData[]
}

const SidebarCharts = memo(function SidebarCharts({ 
  readinessData = [], 
  activatedData = [] 
}: SidebarChartsProps) {
  
  // Calculate max values for scaling
  const maxReadiness = Math.max(
    ...readinessData.flatMap(item => [item.nyValue, item.currentValue]),
    1
  )
  
  const maxActivated = Math.max(
    ...activatedData.flatMap(item => [item.nyValue, item.currentValue]),
    1
  )

  const ChartSection = ({ 
    title, 
    icon, 
    data, 
    maxValue, 
    colors 
  }: {
    title: string
    icon: React.ReactNode
    data: ChartData[]
    maxValue: number
    colors: { ny: string; current: string }
  }) => (
    <div className="bg-slate-800 rounded p-0.5 mb-1">
      {/* Header */}
      <div className="flex items-center gap-1 mb-0.5 text-white">
        {icon}
        <h3 className="font-bold text-[8px] tracking-wide">{title}</h3>
      </div>

      {/* Chart Data */}
      <div className="space-y-0.5">
        {data.map((item, index) => {
          const nyWidth = (item.nyValue / maxValue) * 100
          const currentWidth = (item.currentValue / maxValue) * 100
          
          return (
            <div key={index} className="text-[8px]">
              {/* Location & Values */}
              <div className="flex justify-between items-center mb-0.5 text-gray-300">
                <span className="font-semibold text-[10px] text-white">
                  {item.location.toUpperCase().substring(0, 7)}
                </span>
                <div className="flex gap-1 text-[7px]">
                  <span className={title.includes('ACTIVATED') ? 'text-orange-300' : 'text-purple-300'}>
                    {item.nyValue}
                  </span>
                  <span className={title.includes('ACTIVATED') ? 'text-orange-300' : 'text-purple-300'}>
                    {item.currentValue}
                  </span>
                </div>
              </div>
                
              {/* Horizontal Bar Chart */}
              <div className="relative">
                {/* Full width bar with stacked sections */}
                <div className="flex h-1.5 bg-slate-700 rounded-sm overflow-hidden">
                  {/* NY Value section */}
                  <div 
                    className={`${colors.ny} transition-all duration-500`}
                    style={{ width: `${nyWidth}%` }}
                  />
                  
                  {/* Current Value section */}
                  <div 
                    className={`${colors.current} transition-all duration-500`}
                    style={{ width: `${currentWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-0.5 space-y-0.5 text-[7px]">
        <div className="flex items-center gap-0.5">
          <div className={`w-1 h-1 rounded-sm ${colors.ny}`}></div>
          <span className="text-gray-400">{title.includes('ACTIVATED') ? 'NY Act' : 'NY Ready'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className={`w-1 h-1 rounded-sm ${colors.current}`}></div>
          <span className="text-gray-400">{title.includes('ACTIVATED') ? 'Act' : 'Ready'}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-36 bg-slate-900 p-0.5 min-h-screen">
      {/* 5G Readiness Chart */}
      <ChartSection
        title="5G READINESS"
        icon={<Signal className="h-3 w-3 text-purple-400" />}
        data={readinessData}
        maxValue={maxReadiness}
        colors={{
          ny: 'bg-purple-600',
          current: 'bg-purple-400'
        }}
      />

      {/* 5G Activated Chart */}
      <ChartSection
        title="5G ACTIVATED"
        icon={<Radio className="h-3 w-3 text-green-400" />}
        data={activatedData}
        maxValue={maxActivated}
        colors={{
          ny: 'bg-orange-500',
          current: 'bg-orange-600'
        }}
      />
    </div>
  )
})

export { SidebarCharts } 
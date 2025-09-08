"use client"

import { memo } from 'react'
import { TrendingUp } from 'lucide-react'
import { CompactChart } from './CompactChart'

interface ProgressCurveData {
  period: string
  forecastAccelerate: number
  readiness: number
  activated: number
}

interface CompactProgressCurveProps {
  data: ProgressCurveData[]
}

const CompactProgressCurve = memo(function CompactProgressCurve({ data }: CompactProgressCurveProps) {
  if (!data || data.length === 0) {
    return (
      <CompactChart
        title="PROGRESS CURVE"
        icon={<TrendingUp className="h-3 w-3 text-blue-400" />}
        loading={true}
      >
        <div></div>
      </CompactChart>
    )
  }

  // Find max value for Y-axis scaling
  const maxValue = Math.max(
    ...data.flatMap(item => [item.forecastAccelerate, item.readiness, item.activated]),
    1
  )

  // Chart dimensions - much larger for 80% frame utilization
  const chartWidth = 400  // Increased even more
  const chartHeight = 100  // Much larger height
  const paddingLeft = 25
  const paddingRight = 25
  const paddingTop = 15
  const paddingBottom = 30  // More space for dates
  const chartAreaWidth = chartWidth - paddingLeft - paddingRight
  const chartAreaHeight = chartHeight - paddingTop - paddingBottom

  // Debug log
  console.log('CompactProgressCurve rendered with:', { chartWidth, chartHeight, dataLength: data.length })

  // Calculate x positions for points and dates alignment
  const getXPosition = (index: number) => {
    return paddingLeft + (index / (data.length - 1)) * chartAreaWidth
  }

  // Generate path for line chart
  const generatePath = (values: number[]) => {
    return values.map((value, index) => {
      const x = getXPosition(index)
      const y = paddingTop + chartAreaHeight - ((value / maxValue) * chartAreaHeight)
      return `${x},${y}`
    }).join(' ')
  }

  const forecastPath = generatePath(data.map(d => d.forecastAccelerate))
  const readinessPath = generatePath(data.map(d => d.readiness))
  const activatedPath = generatePath(data.map(d => d.activated))

  return (
    <CompactChart title="PROGRESS CURVE" icon={<TrendingUp className="h-3 w-3 text-blue-400" />}>
      <div className="p-1 h-full flex flex-col overflow-visible">
        {/* Chart Container */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-visible">
          {/* SVG Chart */}
          <div className="relative w-full max-w-[400px] overflow-visible">
            <svg width={chartWidth} height={chartHeight} className="mb-1 overflow-visible">
              {/* Grid lines */}
              {Array.from({ length: 6 }, (_, i) => (
                <line
                  key={i}
                  x1={paddingLeft}
                  y1={paddingTop + (i * chartAreaHeight / 5)}
                  x2={chartWidth - paddingRight}
                  y2={paddingTop + (i * chartAreaHeight / 5)}
                  stroke="rgba(148, 163, 184, 0.1)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Forecast Line */}
              <polyline
                points={data.map((item, index) => {
                  const x = getXPosition(index)
                  const y = paddingTop + chartAreaHeight - (item.forecast * chartAreaHeight / 100)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2.5"
              />

              {/* Readiness Line */}
              <polyline
                points={data.map((item, index) => {
                  const x = getXPosition(index)
                  const y = paddingTop + chartAreaHeight - (item.readiness * chartAreaHeight / 100)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
              />

              {/* Activated Line */}
              <polyline
                points={data.map((item, index) => {
                  const x = getXPosition(index)
                  const y = paddingTop + chartAreaHeight - (item.activated * chartAreaHeight / 100)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
              />

              {/* Data Points */}
              {data.map((item, index) => {
                const x = getXPosition(index)
                const forecastY = paddingTop + chartAreaHeight - (item.forecast * chartAreaHeight / 100)
                const readinessY = paddingTop + chartAreaHeight - (item.readiness * chartAreaHeight / 100)
                const activatedY = paddingTop + chartAreaHeight - (item.activated * chartAreaHeight / 100)

                return (
                  <g key={index}>
                    {/* Vertical guidelines */}
                    <line
                      x1={x}
                      y1={paddingTop + chartAreaHeight}
                      x2={x}
                      y2={chartHeight + 5}
                      stroke="rgba(148, 163, 184, 0.3)"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    
                    {/* Forecast points - CIRCLE */}
                    <circle
                      cx={x}
                      cy={forecastY}
                      r="3"
                      fill="#8B5CF6"
                      stroke="#1F2937"
                      strokeWidth="1"
                    />
                    
                    {/* Readiness points - SQUARE */}
                    <rect
                      x={x-2.5}
                      y={readinessY-2.5}
                      width="5"
                      height="5"
                      fill="#EF4444"
                      stroke="#1F2937"
                      strokeWidth="1"
                    />
                    
                    {/* Activated points - CIRCLE */}
                    <circle
                      cx={x}
                      cy={activatedY}
                      r="3"
                      fill="#10B981"
                      stroke="#1F2937"
                      strokeWidth="1"
                    />
                  </g>
                )
              })}
            </svg>

            {/* Date labels positioned absolutely */}
            <div className="absolute top-full left-0 w-full mt-1">
              <div className="relative w-full h-6">
                {data.map((item, index) => {
                  const x = getXPosition(index)
                  return (
                    <div
                      key={index}
                      className="absolute text-[9px] text-gray-300 font-medium transform -translate-x-1/2"
                      style={{ left: `${x}px` }}
                    >
                      {item.period}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend - Fixed shapes and text */}
        <div className="flex justify-center items-center space-x-4 mt-3 pt-2 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
            <span className="text-[9px] text-gray-300 font-medium">Forecast</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 bg-red-500"></div>
            <span className="text-[9px] text-gray-300 font-medium">Readiness</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <span className="text-[9px] text-gray-300 font-medium">Activated</span>
          </div>
        </div>
      </div>
    </CompactChart>
  )
})

export { CompactProgressCurve } 
"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

interface DailyRunrateData {
  date: string
  readiness: number
  activated: number
}

interface DailyRunrateProps {
  data: DailyRunrateData[]
}

export function DailyRunrate({ data }: DailyRunrateProps) {
  const [hoveredDot, setHoveredDot] = useState<{
    x: number;
    y: number;
    date: string;
    readiness: number;
    activated: number;
    position: 'above' | 'below';
  } | null>(null);

  // Safety check: validate data
  if (!data || data.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white">Daily Runrate - Last 7 Days</CardTitle>
              <p className="text-gray-400 text-sm">5G Readiness & Activation Progress</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">
            No data available for the selected filters
          </div>
        </CardContent>
      </Card>
    )
  }

  // Find max value for Y-axis scaling
  let maxValue = Math.max(
    ...data.flatMap(item => [item.readiness, item.activated])
  ) || 1 // Fallback to 1 if all values are 0 or undefined
  
  // Additional safety check for maxValue
  if (maxValue <= 0) {
    console.warn('maxValue is 0 or negative, setting to 1')
    maxValue = 1
  }

  // Generate SVG path for each line
  const generatePath = (values: number[], color: string) => {
    if (values.length === 0) return null
    
    const width = 800
    const height = 300
    const padding = 60
    
    const chartWidth = width - (padding * 2)
    const chartHeight = height - (padding * 2)
    
    const points = values.map((value, index) => {
      // Safety check: prevent division by zero
      const x = values.length === 1 
        ? padding + (chartWidth / 2) 
        : padding + (index / (values.length - 1)) * chartWidth
      
      const y = height - padding - (value / maxValue) * chartHeight
      return `${x},${y}`
    }).join(' ')
    
    return (
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  // Generate dots for each data point
  const generateDots = (values: number[], color: string, metricType: 'readiness' | 'activated') => {
    if (values.length === 0) return null
    
    const width = 800
    const height = 300
    const padding = 60
    
    const chartWidth = width - (padding * 2)
    const chartHeight = height - (padding * 2)
    
    return values.map((value, index) => {
      // Safety check: prevent division by zero
      const x = values.length === 1 
        ? padding + (chartWidth / 2) 
        : padding + (index / (values.length - 1)) * chartWidth
      
      const y = height - padding - (value / maxValue) * chartHeight
      
      // Safety check: ensure y is a valid number
      if (isNaN(y) || !isFinite(y)) {
        console.warn(`Invalid y value for index ${index}: ${y}, value: ${value}, maxValue: ${maxValue}`)
        return null
      }
      
      // Smart positioning: if dot is in lower half, show tooltip above
      const isLowerHalf = y > (height / 2);
      
      return (
        <g key={index}>
          <circle
            cx={x}
            cy={y}
            r="6"
            fill={color}
            stroke="white"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredDot({
              x: x + 400, // Adjust for centering
              y: isLowerHalf ? y - 80 : y + 80, // Above if lower, below if upper
              date: data[index].date,
              readiness: data[index].readiness,
              activated: data[index].activated,
              position: isLowerHalf ? 'above' : 'below'
            })}
            onMouseLeave={() => setHoveredDot(null)}
          />
          
          {/* Value label with background */}
          <rect
            x={x - 20}
            y={metricType === 'readiness' ? y + 15 : y - 25}
            width={40}
            height={20}
            fill={color}
            rx={6}
            ry={6}
            opacity={0.9}
          />
          <text
            x={x}
            y={metricType === 'readiness' ? y + 32 : y - 12}
            textAnchor="middle"
            className="text-xs font-bold fill-white"
            style={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}
          >
            {value.toLocaleString()}
          </text>
        </g>
      )
    })
  }

  // Extract values for each metric with validation
  const readinessValues = data.map(item => {
    const value = Number(item.readiness) || 0
    if (isNaN(value) || !isFinite(value)) {
      console.warn(`Invalid readiness value: ${item.readiness}, defaulting to 0`)
      return 0
    }
    return value
  })
  
  const activatedValues = data.map(item => {
    const value = Number(item.activated) || 0
    if (isNaN(value) || !isFinite(value)) {
      console.warn(`Invalid activated value: ${item.activated}, defaulting to 0`)
      return 0
    }
    return value
  })

  return (
    <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
      <CardHeader className="pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">Daily Runrate - Last 7 Days</CardTitle>
            <p className="text-gray-400 text-sm">5G Readiness & Activation Progress</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Chart Container */}
        <div className="relative overflow-x-auto">
          {/* Hover Tooltip */}
          {hoveredDot && (
            <div 
              className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg"
              style={{
                left: hoveredDot.x,
                top: hoveredDot.y,
                transform: hoveredDot.position === 'above' 
                  ? 'translate(-50%, -100%)'  // Above: move up
                  : 'translate(-50%, 0%)',    // Below: no vertical shift
                pointerEvents: 'none'
              }}
            >
              <div className="text-white text-sm font-medium mb-2">
                {hoveredDot.date}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300">5G Readiness:</span>
                  <span className="text-white font-medium">{hoveredDot.readiness.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">5G Activated:</span>
                  <span className="text-white font-medium">{hoveredDot.activated.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          
          <svg width="800" height="300" className="mx-auto">
            {/* Grid Lines */}
            <defs>
              <pattern id="grid-daily" width="100" height="50" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 50" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="800" height="300" fill="url(#grid-daily)" />
            
            {/* Chart Lines */}
            {generatePath(readinessValues, '#F97316')} {/* Orange for Readiness */}
            {generatePath(activatedValues, '#10B981')} {/* Green for Activated */}
            
            {/* Chart Dots */}
            {generateDots(readinessValues, '#F97316', 'readiness')}
            {generateDots(activatedValues, '#10B981', 'activated')}
            
            {/* X-axis Labels */}
            {data.map((item, index) => {
              // Safety check: prevent division by zero
              const x = data.length === 1 
                ? 60 + (680 / 2)  // Center if only one data point
                : 60 + (index / (data.length - 1)) * 680
              
              // Safety check: ensure x is a valid number
              if (isNaN(x) || !isFinite(x)) {
                console.warn(`Invalid x value for index ${index}: ${x}, data.length: ${data.length}`)
                return null
              }
              
              return (
                <g key={index}>
                  {/* Invisible hover area */}
                  <rect
                    x={x - 30}
                    y={270}
                    width={60}
                    height={30}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredDot({
                      x: x + 400,
                      y: 200,
                      date: item.date,
                      readiness: item.readiness,
                      activated: item.activated,
                      position: 'above'
                    })}
                    onMouseLeave={() => setHoveredDot(null)}
                  />
                  {/* Date label */}
                  <text
                    x={x}
                    y={290}
                    textAnchor="middle"
                    className="text-xs fill-gray-400 font-medium"
                  >
                    {item.date}
                  </text>
                </g>
              )
            })}
            

          </svg>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center space-x-8 pt-4 border-t border-slate-600">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            <span className="text-sm text-gray-300 font-medium">5G Readiness</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-300 font-medium">5G Activated</span>
          </div>
        </div>
        
        {/* Data Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {readinessValues.reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">Total Readiness</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {activatedValues.reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">Total Activated</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
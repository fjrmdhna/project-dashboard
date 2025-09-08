"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface ProgressCurveData {
  period: string
  forecastAccelerate: number
  readiness: number
  activated: number
}

interface ProgressCurveProps {
  data: ProgressCurveData[]
}

export function ProgressCurve({ data }: ProgressCurveProps) {
  const [hoveredDot, setHoveredDot] = useState<{
    x: number;
    y: number;
    period: string;
    forecastAccelerate: number;
    readiness: number;
    activated: number;
    position: 'above' | 'below';
  } | null>(null);

  // Find max value for Y-axis scaling
  const maxValue = Math.max(
    ...data.flatMap(item => [item.forecastAccelerate, item.readiness, item.activated])
  )

  // Generate SVG path for each line
  const generatePath = (values: number[], color: string) => {
    if (values.length === 0) return null
    
    const width = 400
    const height = 140
    const padding = 30
    
    const chartWidth = width - (padding * 2)
    const chartHeight = height - (padding * 2)
    
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * chartWidth
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
  const generateDots = (values: number[], color: string, metricType: 'forecastAccelerate' | 'readiness' | 'activated') => {
    if (values.length === 0) return null
    
    const width = 800
    const height = 320
    const padding = 60
    
    const chartWidth = width - (padding * 2)
    const chartHeight = height - (padding * 2)
    
    return values.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth
      const y = height - padding - (value / maxValue) * chartHeight
      
      // Get background color based on metric type
      const getBackgroundColor = () => {
        switch (metricType) {
          case 'forecastAccelerate': return '#8B5CF6'; // Purple
          case 'readiness': return '#EF4444'; // Red
          case 'activated': return '#10B981'; // Green
          default: return color;
        }
      };
      
      // Get positioning based on metric type
      const getLabelPosition = () => {
        switch (metricType) {
          case 'forecastAccelerate': 
            return { 
              x: x + 25, 
              y: y, 
              anchor: 'start' as const,
              rectX: x + 10,
              rectWidth: 35
            }; // Right side
          case 'readiness': 
            return { 
              x: x - 25, 
              y: y, 
              anchor: 'end' as const,
              rectX: x - 45,
              rectWidth: 35
            }; // Left side
          case 'activated': 
            return { 
              x: x, 
              y: y - 30, 
              anchor: 'middle' as const,
              rectX: x - 20,
              rectWidth: 40
            }; // Above
          default: 
            return { 
              x: x, 
              y: y - 15, 
              anchor: 'middle' as const,
              rectX: x - 15,
              rectWidth: 30
            };
        }
      };
      
      const labelPos = getLabelPosition();
      
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
            onMouseEnter={() => {
              // Smart positioning: if dot is in lower half, show tooltip above
              const isLowerHalf = y > (height / 2);
              setHoveredDot({
                x: x + 400, // Adjust for centering
                y: isLowerHalf ? y - 80 : y + 80, // Above if lower, below if upper
                period: data[index].period,
                forecastAccelerate: data[index].forecastAccelerate,
                readiness: data[index].readiness,
                activated: data[index].activated,
                position: isLowerHalf ? 'above' : 'below' // Track position for tooltip styling
              });
            }}
            onMouseLeave={() => setHoveredDot(null)}
          />
          
          {/* Background rectangle for value label */}
          <rect
            x={labelPos.rectX}
            y={labelPos.y - 10}
            width={labelPos.rectWidth}
            height={20}
            fill={getBackgroundColor()}
            rx={6}
            ry={6}
            opacity={0.9}
          />
          
          {/* Value label with positioning */}
          <text
            x={labelPos.x}
            y={labelPos.y + 2}
            textAnchor={labelPos.anchor}
            className="text-xs font-bold fill-white"
            style={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}
          >
            {value.toLocaleString()}
          </text>
        </g>
      )
    })
  }

  // Extract values for each metric
  const forecastValues = data.map(item => item.forecastAccelerate)
  const readinessValues = data.map(item => item.readiness)
  const activatedValues = data.map(item => item.activated)

  return (
    <Card className="bg-slate-800 border-slate-700 h-[180px]">
      <CardHeader className="pb-1 px-3 py-2">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-blue-400" />
          <CardTitle className="text-xs font-bold text-white">PROGRESS CURVE</CardTitle>
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
                {hoveredDot.period}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300">Forecast Accelerate:</span>
                  <span className="text-white font-medium">{hoveredDot.forecastAccelerate.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-300">Readiness:</span>
                  <span className="text-white font-medium">{hoveredDot.readiness.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Activated:</span>
                  <span className="text-white font-medium">{hoveredDot.activated.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          
          <svg width="800" height="320" className="mx-auto">
            {/* Grid Lines */}
            <defs>
              <pattern id="grid" width="100" height="50" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 50" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="800" height="320" fill="url(#grid)" />
            
            {/* Chart Lines */}
            {generatePath(forecastValues, '#8B5CF6')}
            {generatePath(readinessValues, '#EF4444')}
            {generatePath(activatedValues, '#10B981')}
            
            {/* Chart Dots */}
            {generateDots(forecastValues, '#8B5CF6', 'forecastAccelerate')}
            {generateDots(readinessValues, '#EF4444', 'readiness')}
            {generateDots(activatedValues, '#10B981', 'activated')}
            
            {/* X-axis Labels */}
            {data.map((item, index) => {
              const x = 60 + (index / (data.length - 1)) * 680
              return (
                <g key={index}>
                  {/* Invisible hover area */}
                  <rect
                    x={x - 30}
                    y={290}
                    width={60}
                    height={40}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredDot({
                      x: x + 400, // Adjust for centering
                      y: 200, // Fixed position above chart
                      period: item.period,
                      forecastAccelerate: item.forecastAccelerate,
                      readiness: item.readiness,
                      activated: item.activated,
                      position: 'above' // Date area always shows above
                    })}
                    onMouseLeave={() => setHoveredDot(null)}
                  />
                  {/* Date label */}
                  <text
                    x={x}
                    y={310}
                    textAnchor="middle"
                    className="text-xs fill-gray-400 font-medium"
                  >
                    {item.period}
                  </text>
                </g>
              )
            })}
            

          </svg>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center space-x-8 pt-4 border-t border-slate-600">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-300 font-medium">Forecast Accelerate</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-300 font-medium">Readiness</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-300 font-medium">Activated</span>
          </div>
        </div>
        
        {/* Data Summary */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {forecastValues.reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">Total Forecast</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
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
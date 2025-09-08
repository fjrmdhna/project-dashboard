"use client"
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface Top5IssueData {
  category: string
  count: number
  color: string
}

interface Top5IssueProps {
  data: Top5IssueData[]
  top5Count: number
  totalCount: number
}

export function Top5IssueChart({ data, top5Count, totalCount }: Top5IssueProps) {
  const [hoveredSegment, setHoveredSegment] = useState<{
    category: string
    count: number
    percentage: number
  } | null>(null)

  // Chart dimensions
  const width = 400
  const height = 300
  const centerX = width / 2
  const centerY = height / 2
  const radius = 80
  const innerRadius = 50

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.count, 0)

  // Generate donut chart segments
  const generateDonutSegments = () => {
    let currentAngle = -90 // Start from top

    return data.map((item, index) => {
      const percentage = (item.count / total) * 100
      const angle = (item.count / total) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle

      // Calculate path for donut segment
      const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180)
      const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180)
      const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180)
      const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180)

      // Large arc flag
      const largeArcFlag = angle > 180 ? 1 : 0

      // Create path
      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${centerX + innerRadius * Math.cos((endAngle * Math.PI) / 180)} ${centerY + innerRadius * Math.sin((endAngle * Math.PI) / 180)}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${centerX + innerRadius * Math.cos((startAngle * Math.PI) / 180)} ${centerY + innerRadius * Math.sin((startAngle * Math.PI) / 180)}`,
        'Z'
      ].join(' ')

      // Calculate center of segment for text
      const midAngle = startAngle + angle / 2
      const textX = centerX + (radius + innerRadius) / 2 * Math.cos((midAngle * Math.PI) / 180)
      const textY = centerY + (radius + innerRadius) / 2 * Math.sin((midAngle * Math.PI) / 180)

      currentAngle += angle

      return (
        <g key={index}>
          {/* Donut segment */}
          <path
            d={path}
            fill={item.color}
            stroke="white"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredSegment({
              category: item.category,
              count: item.count,
              percentage: percentage
            })}
            onMouseLeave={() => setHoveredSegment(null)}
          />
          
          {/* Value label in segment */}
          <text
            x={textX}
            y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-sm font-bold fill-white"
            style={{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }}
          >
            {item.count}
          </text>
        </g>
      )
    })
  }

  return (
    <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
      <CardHeader className="pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">Top 5 Issue</CardTitle>
            <p className="text-gray-400 text-sm">Most frequent issue categories</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-start space-x-6">
          {/* Left side - Donut Chart */}
          <div className="relative">
            <svg width={width} height={height} className="mx-auto">
              {/* Background circle */}
              <circle
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke="#374151"
                strokeWidth="2"
                opacity="0.3"
              />
              
              {/* Donut segments */}
              {generateDonutSegments()}
              
              {/* Center text */}
              <text
                x={centerX}
                y={centerY - 10}
                textAnchor="middle"
                className="text-lg font-bold fill-white"
                style={{ fontSize: '16px', fontFamily: 'Arial, sans-serif' }}
              >
                {top5Count}
              </text>
              <text
                x={centerX}
                y={centerY + 10}
                textAnchor="middle"
                className="text-xs fill-gray-400"
                style={{ fontSize: '10px', fontFamily: 'Arial, sans-serif' }}
              >
                Top 5
              </text>
            </svg>
          </div>

          {/* Right side - Metrics and Legend */}
          <div className="flex-1 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center bg-slate-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{top5Count}</div>
                <div className="text-sm text-gray-400">Top 5 Issue</div>
              </div>
              <div className="text-center bg-slate-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{totalCount}</div>
                <div className="text-sm text-gray-400">Total Issue</div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white mb-3">Issue Categories</h4>
              {data.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-300 flex-1">{item.category}</span>
                  <span className="text-sm font-medium text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredSegment && (
          <div className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
            <div className="text-white text-sm font-medium mb-1">
              {hoveredSegment.category}
            </div>
            <div className="text-xs text-gray-300">
              Count: <span className="text-white font-medium">{hoveredSegment.count}</span>
            </div>
            <div className="text-xs text-gray-300">
              Percentage: <span className="text-white font-medium">{hoveredSegment.percentage.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
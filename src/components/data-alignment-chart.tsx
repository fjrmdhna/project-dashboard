"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface DataAlignmentChartProps {
  data: {
    totalSites: number
    alignedSites: number
    misalignedSites: number
    alignmentRate: number
    trends: {
      total: number
      aligned: number
      misaligned: number
    }
  } | null
}

export function DataAlignmentChart({ data }: DataAlignmentChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Alignment Status
          </CardTitle>
          <CardDescription>
            Real-time data alignment monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Ensure all values are valid numbers
  const totalSites = Number(data.totalSites) || 0
  const alignedSites = Number(data.alignedSites) || 0
  const misalignedSites = Number(data.misalignedSites) || 0
  const alignmentRate = Number(data.alignmentRate) || 0

  // Chart dimensions
  const chartWidth = 400
  const chartHeight = 200
  const barWidth = 60
  const maxValue = Math.max(totalSites, alignedSites, misalignedSites, 1) // Ensure at least 1 to avoid division by zero

  // Calculate bar heights (ensure they're valid numbers)
  const totalHeight = totalSites > 0 ? (totalSites / maxValue) * chartHeight : 0
  const alignedHeight = alignedSites > 0 ? (alignedSites / maxValue) * chartHeight : 0
  const misalignedHeight = misalignedSites > 0 ? (misalignedSites / maxValue) * chartHeight : 0

  // Calculate y positions (ensure they're valid numbers)
  const totalY = chartHeight - totalHeight
  const alignedY = chartHeight - alignedHeight
  const misalignedY = chartHeight - misalignedHeight

  // Bar data with safe values
  const bars = [
    {
      key: 'total',
      label: 'Total Sites',
      value: totalSites,
      height: Math.max(0, totalHeight), // Ensure non-negative
      y: Math.max(0, totalY), // Ensure non-negative
      x: 50,
      color: 'hsl(var(--primary))',
      trend: data.trends?.total || 0
    },
    {
      key: 'aligned',
      label: 'Aligned',
      value: alignedSites,
      height: Math.max(0, alignedHeight), // Ensure non-negative
      y: Math.max(0, alignedY), // Ensure non-negative
      x: 150,
      color: 'hsl(var(--chart-1))',
      trend: data.trends?.aligned || 0
    },
    {
      key: 'misaligned',
      label: 'Misaligned',
      value: misalignedSites,
      height: Math.max(0, misalignedHeight), // Ensure non-negative
      y: Math.max(0, misalignedY), // Ensure non-negative
      x: 250,
      color: 'hsl(var(--destructive))',
      trend: data.trends?.misaligned || 0
    }
  ]

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  const getTrendColor = (trend: number) => {
    if (trend > 0) return "text-green-600"
    if (trend < 0) return "text-red-600"
    return "text-gray-600"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Data Alignment Status
        </CardTitle>
        <CardDescription>
          Real-time data alignment monitoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{totalSites.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Sites</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(data.trends?.total || 0)}
                <span className={`text-xs ${getTrendColor(data.trends?.total || 0)}`}>
                  {Math.abs(data.trends?.total || 0)}%
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{alignedSites.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Aligned</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(data.trends?.aligned || 0)}
                <span className={`text-xs ${getTrendColor(data.trends?.aligned || 0)}`}>
                  {Math.abs(data.trends?.aligned || 0)}%
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{misalignedSites.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Misaligned</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(data.trends?.misaligned || 0)}
                <span className={`text-xs ${getTrendColor(data.trends?.misaligned || 0)}`}>
                  {Math.abs(data.trends?.misaligned || 0)}%
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{alignmentRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Alignment Rate</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(alignmentRate - 100)}
                <span className={`text-xs ${getTrendColor(alignmentRate - 100)}`}>
                  {Math.abs(alignmentRate - 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="flex justify-center">
            <svg width={chartWidth} height={chartHeight} className="border rounded-lg">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1={0}
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              ))}
              
              {/* Bars */}
              {bars.map((bar) => (
                <g key={bar.key}>
                  {/* Bar */}
                  <rect
                    x={bar.x - barWidth / 2}
                    y={bar.y}
                    width={barWidth}
                    height={bar.height}
                    fill={bar.color}
                    opacity={0.8}
                    rx={4}
                  />
                  
                  {/* Value labels */}
                  <text
                    x={bar.x}
                    y={bar.y - 5}
                    textAnchor="middle"
                    className="text-xs font-medium fill-foreground"
                  >
                    {bar.value.toLocaleString()}
                  </text>
                  
                  {/* Bar labels */}
                  <text
                    x={bar.x}
                    y={chartHeight + 20}
                    textAnchor="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {bar.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Alignment Progress</span>
              <span className="font-medium">{alignmentRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, alignmentRate))}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
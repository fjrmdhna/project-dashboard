"use client"

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { 
  ResponsiveContainer, 
  LineChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  Line 
} from 'recharts'

interface AccDataPoint {
  month: string
  planRfiAcc: number
  actualRfiAcc: number
  actualCrfiAcc: number
}

interface TLPAccChartProps {
  data: AccDataPoint[]
  className?: string
}

// Custom tooltip component
const AccTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-[#1a1f3a] border border-white/10 p-3 shadow-lg">
        <p className="text-xs font-semibold text-white mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-white/80">{entry.name}:</span>
              <span className="text-xs font-semibold text-white">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// Custom dot with label for PLAN RFI ACC (Yellow)
const PlanRfiDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props
  const value = payload?.planRfiAcc
  
  if (value === null || value === undefined || value === 0) {
    return null
  }
  
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#FBBF24" />
      <rect
        x={cx + 6}
        y={cy - 16}
        width={20}
        height={12}
        fill="rgba(251, 191, 36, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      <text
        x={cx + 16}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  )
}

// Custom dot with label for ACTUAL RFI ACC (Blue)
const ActualRfiDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props
  const value = payload?.actualRfiAcc
  
  if (value === null || value === undefined || value === 0) {
    return null
  }
  
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#3B82F6" />
      <rect
        x={cx + 6}
        y={cy + 4}
        width={20}
        height={12}
        fill="rgba(59, 130, 246, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      <text
        x={cx + 16}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  )
}

// Custom dot with label for ACTUAL CRFI ACC (Green)
const ActualCrfiDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props
  const value = payload?.actualCrfiAcc
  
  if (value === null || value === undefined || value === 0) {
    return null
  }
  
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#10B981" />
      <rect
        x={cx + 6}
        y={cy + 4}
        width={20}
        height={12}
        fill="rgba(16, 185, 129, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      <text
        x={cx + 16}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  )
}

export default function TLPAccChart({ data, className }: TLPAccChartProps) {
  // Calculate max value for Y-axis
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 4000
    
    const allValues = data.flatMap(d => [
      d.planRfiAcc,
      d.actualRfiAcc,
      d.actualCrfiAcc
    ])
    
    const max = Math.max(...allValues.filter(v => typeof v === 'number'))
    // Round up to nearest 500
    return Math.ceil(max / 500) * 500
  }, [data])
  
  return (
    <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 p-0.5 w-full h-full flex flex-col min-w-0 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-1 mb-1 flex-shrink-0">
        <div className="bg-orange-500/20 p-0.5 rounded-sm">
          <TrendingUp className="h-2 w-2 text-orange-400" />
        </div>
        <div className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">
          ACC Progress
        </div>
      </div>
      
      {/* Chart - Flexible Height */}
      <div className="flex-1 flex flex-col min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data} 
            margin={{ top: 30, right: 30, left: 30, bottom: 5 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,.06)" strokeDasharray="2 2" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: '#B0B7C3', fontSize: 6 }}
              height={40}
              tickMargin={2}
              angle={-45}
              textAnchor="end"
            />
            <YAxis 
              tick={{ fill: '#B0B7C3', fontSize: 6 }} 
              allowDecimals={false}
              width={25}
              domain={[0, maxValue]}
              ticks={Array.from({ length: Math.floor(maxValue / 500) + 1 }, (_, i) => i * 500)}
            />
            <Tooltip content={<AccTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={30}
              iconType="circle"
              iconSize={6}
              formatter={(value) => (
                <span className="text-[10px] text-gray-300">{value}</span>
              )}
              wrapperStyle={{ paddingTop: '5px' }}
            />
            <Line 
              dataKey="planRfiAcc" 
              name="PLAN RFI ACC" 
              stroke="#FBBF24" 
              strokeWidth={1.5} 
              dot={<PlanRfiDotWithLabel />}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line 
              dataKey="actualRfiAcc" 
              name="ACTUAL RFI ACC" 
              stroke="#3B82F6" 
              strokeWidth={1.5} 
              dot={<ActualRfiDotWithLabel />}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line 
              dataKey="actualCrfiAcc" 
              name="ACTUAL CRFI ACC" 
              stroke="#10B981" 
              strokeWidth={1.5} 
              dot={<ActualCrfiDotWithLabel />}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


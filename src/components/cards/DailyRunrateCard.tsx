"use client"

import { BarChart } from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { DailyRunrateItem } from "@/hooks/useDailyRunrateData"
import { AopDailyRunrateItem } from "@/hooks/useAopDailyRunrateData"

const DEFAULT_DAILY_RUNRATE_TITLE = "Daily Runrate – Last 7 Days"

export interface DailyRunrateCardProps {
  data: DailyRunrateItem[] | AopDailyRunrateItem[]
  isLoading?: boolean
  /** Card header badge text */
  title?: string
  /** Override legend/tooltip labels for forecast & actual series */
  seriesLabels?: {
    forecast?: string
    actual?: string
  }
}

export function DailyRunrateCard({
  data,
  isLoading = false,
  title = DEFAULT_DAILY_RUNRATE_TITLE,
  seriesLabels,
}: DailyRunrateCardProps) {
  const forecastLabel = seriesLabels?.forecast ?? 'Forecast'
  const actualLabel = seriesLabels?.actual ?? 'Actual'
  // Detect if data is AOP format (has forecast/actual) or legacy format (has readiness/activated)
  const isAopFormat = data.length > 0 && ('forecast' in data[0] || 'actual' in data[0])
  const legacyForecastLabel = seriesLabels?.forecast ?? 'Readiness'
  const legacyActualLabel = seriesLabels?.actual ?? 'Activated'
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A2340] border border-white/10 px-3 py-2 rounded-md text-xs">
          <p className="text-white/90 font-semibold mb-1">{label}</p>
          <div className="space-y-1">
            {isAopFormat ? (
              <>
                <p className="text-[#8A5AA3]">
                  <span className="text-white/80">{forecastLabel}: </span>
                  {payload[0].value}
                </p>
                <p className="text-[#7CB342]">
                  <span className="text-white/80">{actualLabel}: </span>
                  {payload[1].value}
                </p>
              </>
            ) : (
              <>
                <p className="text-[#8A5AA3]">
                  <span className="text-white/80">{legacyForecastLabel}: </span>
                  {payload[0].value}
                </p>
                <p className="text-[#7CB342]">
                  <span className="text-white/80">{legacyActualLabel}: </span>
                  {payload[1].value}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom label for data points
  const renderLabel = (props: any) => {
    const { x, y, value, index } = props;
    // Only render label if value is not 0
    if (value === 0) return null;
    
    return (
      <text
        x={x}
        y={y - 8}
        fill="#FFFFFF"
        fontSize={9}
        textAnchor="middle"
        style={{ 
          filter: 'drop-shadow(0px 0px 1px rgba(0,0,0,0.7))',
          textShadow: '0px 0px 2px rgba(0,0,0,0.7)'
        }}
      >
        {value}
      </text>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="bg-blue-500/20 p-1 rounded-md">
            <BarChart className="h-3 w-3 text-blue-400" />
          </div>
          <div className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">
            {title}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          Loading...
        </div>
      </div>
    );
  }

  // Check if all data values are 0 (empty state)
  const hasNoData = data.length === 0 || data.every(item => {
    if ('forecast' in item && 'actual' in item) {
      return item.forecast === 0 && item.actual === 0
    }
    if ('readiness' in item && 'activated' in item) {
      return (item as any).readiness === 0 && (item as any).activated === 0
    }
    return true
  })

  // Empty state - when no runrate data for current filter
  if (hasNoData) {
    return (
      <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-shrink-0">
          <div className="bg-blue-500/20 p-1 rounded-md">
            <BarChart className="h-3 w-3 text-blue-400" />
          </div>
          <div className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">
            {title}
          </div>
        </div>
        
        {/* Empty state message */}
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          No runrate data for current filter
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-shrink-0">
        <div className="bg-blue-500/20 p-1 rounded-md">
          <BarChart className="h-3 w-3 text-blue-400" />
        </div>
        <div className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">
          {title}
        </div>
      </div>
      
      {/* Chart */}
      <div className="flex-1 flex flex-col min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 15,
              right: 5,
              left: 0,
              bottom: -5
            }}
          >
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis 
              dataKey="date"
              tick={{ fill: '#B0B7C3', fontSize: 8 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              interval={0}
              angle={-45}
              height={undefined}
              textAnchor="end"
              tickMargin={8}
            />
            <YAxis 
              tick={{ fill: '#B0B7C3', fontSize: 8 }}
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={undefined} 
              iconType="circle" 
              iconSize={6}
              formatter={(value) => (
                <span className="text-[10px] text-gray-300">{value}</span>
              )}
              wrapperStyle={{ paddingTop: '5px' }}
            />
            {isAopFormat ? (
              <>
                <Line 
                  type="monotone"
                  dataKey="forecast"
                  name={forecastLabel}
                  stroke="#8A5AA3"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#8A5AA3', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#8A5AA3', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  label={renderLabel}
                />
                <Line 
                  type="monotone"
                  dataKey="actual"
                  name={actualLabel}
                  stroke="#7CB342"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#7CB342', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#7CB342', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={1000}
                  label={renderLabel}
                />
              </>
            ) : (
              <>
                <Line 
                  type="monotone"
                  dataKey="readiness"
                  name={legacyForecastLabel}
                  stroke="#8A5AA3"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#8A5AA3', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#8A5AA3', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  label={renderLabel}
                />
                <Line 
                  type="monotone"
                  dataKey="activated"
                  name={legacyActualLabel}
                  stroke="#7CB342"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#7CB342', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#7CB342', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={1000}
                  label={renderLabel}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 

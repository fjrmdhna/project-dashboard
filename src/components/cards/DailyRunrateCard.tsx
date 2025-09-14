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

export interface DailyRunrateCardProps {
  data: DailyRunrateItem[]
  isLoading?: boolean
}

export function DailyRunrateCard({ data, isLoading = false }: DailyRunrateCardProps) {
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A2340] border border-white/10 px-3 py-2 rounded-md text-xs">
          <p className="text-white/90 font-semibold mb-1">{label}</p>
          <div className="space-y-1">
            <p className="text-[#8A5AA3]">
              <span className="text-white/80">Readiness: </span>
              {payload[0].value}
            </p>
            <p className="text-[#7CB342]">
              <span className="text-white/80">Activated: </span>
              {payload[1].value}
            </p>
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
            Daily Runrate – Last 7 Days
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          Loading...
        </div>
      </div>
    );
  }

  // Log data untuk debugging
  console.log("Daily Runrate Data:", data);
  
  return (
    <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <div className="bg-blue-500/20 p-1 rounded-md">
          <BarChart className="h-3 w-3 text-blue-400" />
        </div>
        <div className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">
          Daily Runrate – Last 7 Days
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
            <Line 
              type="monotone"
              dataKey="readiness"
              name="5G Readiness"
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
              name="5G Activated"
              stroke="#7CB342"
              strokeWidth={1.5}
              dot={{ r: 3, fill: '#7CB342', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#7CB342', stroke: '#fff', strokeWidth: 1 }}
              isAnimationActive={true}
              animationDuration={1000}
              label={renderLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 
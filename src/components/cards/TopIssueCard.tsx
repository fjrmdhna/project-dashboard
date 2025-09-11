"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts"
import { TopIssue } from "@/hooks/useTopIssueData"

export interface TopIssueCardProps {
  issues: TopIssue[]
  totalIssues: number
  topIssuesTotal?: number
  isLoading?: boolean
}

export function TopIssueCard({ issues, totalIssues, topIssuesTotal, isLoading = false }: TopIssueCardProps) {
  // Memproses data untuk chart
  const { chartData, calculatedTopTotal } = useMemo(() => {
    // Jika masih loading atau tidak ada data, kembalikan array kosong
    if (isLoading || !issues || issues.length === 0) {
      return {
        chartData: [],
        calculatedTopTotal: 0
      }
    }
    
    // Data sudah disorting dari API, jadi kita bisa langsung gunakan
    const topTotal = issues.reduce((sum, issue) => sum + issue.count, 0)
    
    return {
      chartData: issues,
      calculatedTopTotal: topTotal
    }
  }, [issues, isLoading])
  
  // Total top issues (gunakan dari props jika ada, atau dari kalkulasi)
  const topTotal = topIssuesTotal !== undefined ? topIssuesTotal : calculatedTopTotal

  // Custom renderer untuk label di dalam slice
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }: any) => {
    // Jika tidak ada data atau masih loading, jangan tampilkan label
    if (isLoading || chartData.length === 0 || percent < 0.05) return null
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180)
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180)
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="#FFFFFF" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
        style={{ 
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))',
          textShadow: '0px 0px 3px rgba(0,0,0,0.7)'
        }}
      >
        {chartData[index].count}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percentage = ((item.count / totalIssues) * 100).toFixed(1)
      
      return (
        <div className="bg-[#1A2340] border border-white/10 px-3 py-2 rounded-md text-xs">
          <p className="text-white/90 font-medium">{item.category}</p>
          <p className="text-white/80">Count: {item.count}</p>
          <p className="text-white/80">Percentage: {percentage}%</p>
        </div>
      )
    }
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-red-500/20 p-1.5 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-xs font-medium bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              5 Top Issue
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-red-500/20 p-1.5 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-xs font-medium bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
            5 Top Issue
          </div>
        </div>
        
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{topTotal}</div>
            <div className="text-xs text-[#B0B7C3]">5 Top Issue</div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{totalIssues}</div>
            <div className="text-xs text-[#B0B7C3]">Total Issue</div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Donut Chart (Left) */}
        <div className="w-full md:w-1/2 h-[200px] md:h-auto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius="90%"
                innerRadius="60%"
                fill="#8884d8"
                dataKey="count"
                stroke="#0F1630"
                strokeWidth={1}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Issue List (Right) */}
        <div className="w-full md:w-1/2 pl-0 md:pl-4 mt-4 md:mt-0">
          <div className="text-sm font-semibold text-white mb-2">5 Top Issue</div>
          <div className="space-y-2">
            {chartData.map((issue, index) => (
              <div key={index} className="flex items-start gap-2">
                <div 
                  className="w-3 h-3 rounded-full mt-1" 
                  style={{ backgroundColor: issue.color }}
                />
                <div className="text-xs text-[#B0B7C3] flex-1 truncate">
                  {issue.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 
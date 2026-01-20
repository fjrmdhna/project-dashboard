"use client"

import { useMemo } from "react"
import { Target } from "lucide-react"

// Type for row data
interface Row {
  region_circle?: string | null
  rfs_af?: string | null                    // Achievement (Actual)
  mocn_activation_forecast?: string | null  // Target (MOCN Activation Forecast)
}

// Pre-aggregated data from useAopData hook (OPTIMIZATION)
type AggregatedByCircle = Map<string, { total: number; ready: number; activated: number; rfi: number }>

export interface CircleAchievementCardProps {
  rows: Row[]
  isLoading?: boolean
  // OPTIMIZATION: Pre-aggregated data to avoid row iteration
  aggregatedByCircle?: AggregatedByCircle
}

interface CircleData {
  circle: string
  achievement: number  // Count of rfs_af in current month
  target: number       // Count of mocn_activation_forecast in current month
  remaining: number    // target - achievement
}

// Helper function to check if date is in current month
function isInCurrentMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  
  try {
    const date = new Date(dateStr)
    const now = new Date()
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  } catch {
    return false
  }
}

// Helper function to get current month name
function getCurrentMonthName(): string {
  const now = new Date()
  return now.toLocaleString('en-US', { month: 'short' })
}

// Helper to normalize circle name
function normalizeCircle(circle: string | null | undefined): string {
  if (!circle) return "Unknown"
  return circle.trim().toUpperCase()
}

export function CircleAchievementCard({ rows, isLoading = false }: CircleAchievementCardProps) {
  const currentMonth = useMemo(() => getCurrentMonthName(), [])
  
  // Calculate achievement data per circle
  const circleData = useMemo(() => {
    if (isLoading || !rows || rows.length === 0) {
      return []
    }

    // Group data by circle
    const circleMap = new Map<string, { achievement: number; target: number }>()

    // Single pass through rows
    for (const row of rows) {
      const circle = normalizeCircle(row.region_circle)
      
      const data = circleMap.get(circle) || { achievement: 0, target: 0 }
      
      // Count achievement (rfs_af in current month)
      if (isInCurrentMonth(row.rfs_af)) {
        data.achievement++
      }
      
      // Count target (mocn_activation_forecast in current month)
      if (isInCurrentMonth(row.mocn_activation_forecast)) {
        data.target++
      }
      
      circleMap.set(circle, data)
    }

    // Convert to array and calculate remaining
    const result: CircleData[] = Array.from(circleMap.entries())
      .map(([circle, data]) => ({
        circle,
        achievement: data.achievement,
        target: data.target,
        remaining: data.target - data.achievement
      }))
      .filter(item => item.target > 0 || item.achievement > 0) // Only show circles with data
      .sort((a, b) => b.target - a.target) // Sort by target descending

    return result
  }, [rows, isLoading])

  // Calculate totals
  const totals = useMemo(() => {
    return circleData.reduce(
      (acc, item) => ({
        achievement: acc.achievement + item.achievement,
        target: acc.target + item.target,
        remaining: acc.remaining + item.remaining
      }),
      { achievement: 0, target: 0, remaining: 0 }
    )
  }, [circleData])

  // Get remaining color based on value
  const getRemainingColor = (remaining: number) => {
    if (remaining <= 0) return "text-green-400"
    if (remaining <= 20) return "text-yellow-400"
    return "text-orange-400"
  }

  const getRemainingBg = (remaining: number) => {
    if (remaining <= 0) return "bg-green-500/10"
    if (remaining <= 20) return "bg-yellow-500/10"
    return "bg-orange-500/10"
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex items-center justify-center" style={{ padding: 'calc(var(--wb-card-padding) - 4px)' }}>
        <div className="animate-pulse text-white/50 text-[9px]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0" style={{ padding: 'calc(var(--wb-card-padding) - 4px)' }}>
      {/* Header - Same style as other cards */}
      <div className="flex items-center gap-2 mb-1 flex-shrink-0">
        <div className="bg-cyan-500/20 p-0.5 rounded-lg">
          <Target className="h-3 w-3 text-cyan-400" />
        </div>
        <div className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">
          Circle Achievement
        </div>
      </div>

      {/* Table - Compact but readable */}
      <div className="flex-1 flex flex-col justify-center">
        <table className="w-full text-[8px] border-collapse">
          <thead>
            <tr>
              <th className="text-left py-0.5 px-1.5 text-white/60 font-medium bg-white/5 rounded-tl-lg">
                Circle
              </th>
              <th className="text-center py-0.5 px-1.5 text-white/60 font-medium bg-green-500/10">
                Ach. {currentMonth}
              </th>
              <th className="text-center py-0.5 px-1.5 text-white/60 font-medium bg-cyan-500/10">
                Target {currentMonth}
              </th>
              <th className="text-center py-0.5 px-1.5 text-white/60 font-medium bg-orange-500/10 rounded-tr-lg">
                Rem.
              </th>
            </tr>
          </thead>
          <tbody>
            {circleData.map((item) => (
              <tr key={item.circle} className="border-t border-white/5">
                <td className="py-0.5 px-1.5 text-white/80 font-medium">
                  {item.circle}
                </td>
                <td className="py-0.5 px-1.5 text-center text-green-400 font-semibold bg-green-500/5">
                  {item.achievement.toLocaleString()}
                </td>
                <td className="py-0.5 px-1.5 text-center text-cyan-400 font-semibold bg-cyan-500/5">
                  {item.target.toLocaleString()}
                </td>
                <td className={`py-0.5 px-1.5 text-center font-semibold ${getRemainingColor(item.remaining)} ${getRemainingBg(item.remaining)}`}>
                  {item.remaining.toLocaleString()}
                </td>
              </tr>
            ))}
            
            {/* Total Row */}
            <tr className="border-t border-white/20 bg-white/5">
              <td className="py-0.5 px-1.5 text-white font-bold rounded-bl-lg">Total</td>
              <td className="py-0.5 px-1.5 text-center text-green-300 font-bold">
                {totals.achievement.toLocaleString()}
              </td>
              <td className="py-0.5 px-1.5 text-center text-cyan-300 font-bold">
                {totals.target.toLocaleString()}
              </td>
              <td className={`py-0.5 px-1.5 text-center font-bold rounded-br-lg ${getRemainingColor(totals.remaining)}`}>
                {totals.remaining.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {circleData.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/40 text-[8px]">
            No data for current month
          </div>
        )}
      </div>
    </div>
  )
}

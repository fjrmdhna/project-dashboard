"use client"

import { useMemo } from "react"
import { Target } from "lucide-react"

// Type for row data
interface Row {
  region_circle?: string | null
  rfs_af?: string | null                    // Achievement (Actual)
  mocn_activation_forecast?: string | null  // Target (MOCN Activation Forecast)
}

export interface CircleAchievementCardProps {
  rows: Row[]
  isLoading?: boolean
}

interface CircleData {
  circle: string
  // MTD: from start of current month through today
  mtdTarget: number
  mtdActual: number
  mtdRemaining: number
  // YTD: from start of current year through today
  ytdTarget: number
  ytdActual: number
  ytdRemaining: number
}

/** End of today (23:59:59.999) for "through today" ranges */
function getEndOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

/**
 * Date ranges for MTD and YTD: from period start through today (inclusive).
 * Target and Actual both use these ranges for consistent comparison.
 */
function getDateRanges(): { mtdStart: Date; mtdEnd: Date; ytdStart: Date; ytdEnd: Date } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const endOfToday = getEndOfToday()

  return {
    // MTD: First day of current month through today
    mtdStart: new Date(year, month, 1, 0, 0, 0, 0),
    mtdEnd: endOfToday,
    // YTD: First day of current year through today
    ytdStart: new Date(year, 0, 1, 0, 0, 0, 0),
    ytdEnd: endOfToday
  }
}

// Helper function to check if date is within a range
function isInRange(dateStr: string | null | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false
  
  try {
    const date = new Date(dateStr)
    return !isNaN(date.getTime()) && date >= start && date <= end
  } catch {
    return false
  }
}

// Helper function to get current month name
function getCurrentMonthName(): string {
  const now = new Date()
  return now.toLocaleString('en-US', { month: 'short' })
}

// Helper function to get current year
function getCurrentYear(): number {
  return new Date().getFullYear()
}

// Helper to normalize circle name
function normalizeCircle(circle: string | null | undefined): string {
  if (!circle) return "Unknown"
  return circle.trim().toUpperCase()
}

// Get color based on remaining value (negative = over-achieved, positive = under-achieved)
function getRemainingColor(remaining: number): string {
  if (remaining <= 0) return "text-green-400"
  if (remaining <= 20) return "text-yellow-400"
  return "text-orange-400"
}

function getRemainingBg(remaining: number): string {
  if (remaining <= 0) return "bg-green-500/10"
  if (remaining <= 20) return "bg-yellow-500/10"
  return "bg-orange-500/10"
}

// Get achievement rate color (actual vs target percentage)
function getAchievementColor(actual: number, target: number): string {
  if (target === 0) return "text-gray-400"
  const rate = (actual / target) * 100
  if (rate >= 100) return "text-green-400"
  if (rate >= 80) return "text-lime-400"
  if (rate >= 60) return "text-yellow-400"
  return "text-orange-400"
}

export function CircleAchievementCard({ rows, isLoading = false }: CircleAchievementCardProps) {
  const currentMonth = useMemo(() => getCurrentMonthName(), [])
  const currentYear = useMemo(() => getCurrentYear(), [])
  
  // Calculate MTD and YTD achievement data per circle
  const circleData = useMemo(() => {
    if (isLoading || !rows || rows.length === 0) {
      return []
    }

    const { mtdStart, mtdEnd, ytdStart, ytdEnd } = getDateRanges()

    // Group data by circle
    const circleMap = new Map<string, {
      mtdTarget: number
      mtdActual: number
      ytdTarget: number
      ytdActual: number
    }>()

    // Single pass through rows
    for (const row of rows) {
      const circle = normalizeCircle(row.region_circle)
      
      const data = circleMap.get(circle) || {
        mtdTarget: 0,
        mtdActual: 0,
        ytdTarget: 0,
        ytdActual: 0
      }
      
      // MTD calculations (current month only)
      if (isInRange(row.mocn_activation_forecast, mtdStart, mtdEnd)) {
        data.mtdTarget++
      }
      if (isInRange(row.rfs_af, mtdStart, mtdEnd)) {
        data.mtdActual++
      }
      
      // YTD calculations (current year only)
      if (isInRange(row.mocn_activation_forecast, ytdStart, ytdEnd)) {
        data.ytdTarget++
      }
      if (isInRange(row.rfs_af, ytdStart, ytdEnd)) {
        data.ytdActual++
      }
      
      circleMap.set(circle, data)
    }

    // Convert to array and calculate remaining
    const result: CircleData[] = Array.from(circleMap.entries())
      .map(([circle, data]) => ({
        circle,
        mtdTarget: data.mtdTarget,
        mtdActual: data.mtdActual,
        mtdRemaining: data.mtdTarget - data.mtdActual,
        ytdTarget: data.ytdTarget,
        ytdActual: data.ytdActual,
        ytdRemaining: data.ytdTarget - data.ytdActual
      }))
      .filter(item => 
        item.mtdTarget > 0 || item.mtdActual > 0 || 
        item.ytdTarget > 0 || item.ytdActual > 0
      ) // Only show circles with data
      .sort((a, b) => b.ytdTarget - a.ytdTarget) // Sort by YTD target descending

    return result
  }, [rows, isLoading])

  // Calculate totals
  const totals = useMemo(() => {
    return circleData.reduce(
      (acc, item) => ({
        mtdTarget: acc.mtdTarget + item.mtdTarget,
        mtdActual: acc.mtdActual + item.mtdActual,
        mtdRemaining: acc.mtdRemaining + item.mtdRemaining,
        ytdTarget: acc.ytdTarget + item.ytdTarget,
        ytdActual: acc.ytdActual + item.ytdActual,
        ytdRemaining: acc.ytdRemaining + item.ytdRemaining
      }),
      { mtdTarget: 0, mtdActual: 0, mtdRemaining: 0, ytdTarget: 0, ytdActual: 0, ytdRemaining: 0 }
    )
  }, [circleData])

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex items-center justify-center" style={{ padding: 'calc(var(--wb-card-padding) - 4px)' }}>
        <div className="animate-pulse text-white/50 text-[9px]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0 p-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-cyan-500/20 p-0.5 rounded">
            <Target className="h-2.5 w-2.5 text-cyan-400" />
          </div>
          <span className="text-[8px] font-semibold text-cyan-300">Circle Achievement</span>
        </div>
        {/* Glossary */}
        <div className="flex items-center gap-2 text-[6px]">
          <span className="text-cyan-400 font-medium">T<span className="text-white/50">=Target</span></span>
          <span className="text-green-400 font-medium">A<span className="text-white/50">=Actual</span></span>
          <span className="text-orange-400 font-medium">R<span className="text-white/50">=Remaining</span></span>
        </div>
      </div>

      {/* Table - fit content, no flex-1 to avoid blank space */}
      <table className="w-full text-[7px] border-collapse table-fixed">
        <thead>
          <tr>
            <th rowSpan={2} className="text-left py-0.5 px-1 text-white/60 font-medium bg-white/5 w-[20%]">
              Circle
            </th>
            <th colSpan={3} className="text-center py-0.5 px-0.5 text-white/80 font-semibold bg-indigo-500/15 w-[40%]">
              MTD {currentMonth}
            </th>
            <th colSpan={3} className="text-center py-0.5 px-0.5 text-white/80 font-semibold bg-purple-500/15 w-[40%]">
              YTD {currentYear}
            </th>
          </tr>
          <tr>
            <th className="text-center py-0.5 px-0.5 text-cyan-400/80 font-medium bg-cyan-500/10">T</th>
            <th className="text-center py-0.5 px-0.5 text-green-400/80 font-medium bg-green-500/10">A</th>
            <th className="text-center py-0.5 px-0.5 text-orange-400/80 font-medium bg-orange-500/10">R</th>
            <th className="text-center py-0.5 px-0.5 text-cyan-400/80 font-medium bg-cyan-500/10">T</th>
            <th className="text-center py-0.5 px-0.5 text-green-400/80 font-medium bg-green-500/10">A</th>
            <th className="text-center py-0.5 px-0.5 text-orange-400/80 font-medium bg-orange-500/10">R</th>
          </tr>
        </thead>
        <tbody>
          {circleData.map((item) => (
            <tr key={item.circle} className="border-t border-white/5">
              <td className="py-0.5 px-1 text-white/80 font-medium truncate" title={item.circle}>
                {item.circle}
              </td>
              <td className="py-0.5 px-0.5 text-center text-cyan-400 font-semibold">{item.mtdTarget}</td>
              <td className={`py-0.5 px-0.5 text-center font-semibold ${getAchievementColor(item.mtdActual, item.mtdTarget)}`}>{item.mtdActual}</td>
              <td className={`py-0.5 px-0.5 text-center font-semibold ${getRemainingColor(item.mtdRemaining)}`}>{item.mtdRemaining}</td>
              <td className="py-0.5 px-0.5 text-center text-cyan-400 font-semibold">{item.ytdTarget}</td>
              <td className={`py-0.5 px-0.5 text-center font-semibold ${getAchievementColor(item.ytdActual, item.ytdTarget)}`}>{item.ytdActual}</td>
              <td className={`py-0.5 px-0.5 text-center font-semibold ${getRemainingColor(item.ytdRemaining)}`}>{item.ytdRemaining}</td>
            </tr>
          ))}
          <tr className="border-t border-white/20 bg-white/5">
            <td className="py-0.5 px-1 text-white font-bold">Total</td>
            <td className="py-0.5 px-0.5 text-center text-cyan-300 font-bold">{totals.mtdTarget}</td>
            <td className={`py-0.5 px-0.5 text-center font-bold ${getAchievementColor(totals.mtdActual, totals.mtdTarget)}`}>{totals.mtdActual}</td>
            <td className={`py-0.5 px-0.5 text-center font-bold ${getRemainingColor(totals.mtdRemaining)}`}>{totals.mtdRemaining}</td>
            <td className="py-0.5 px-0.5 text-center text-cyan-300 font-bold">{totals.ytdTarget}</td>
            <td className={`py-0.5 px-0.5 text-center font-bold ${getAchievementColor(totals.ytdActual, totals.ytdTarget)}`}>{totals.ytdActual}</td>
            <td className={`py-0.5 px-0.5 text-center font-bold ${getRemainingColor(totals.ytdRemaining)}`}>{totals.ytdRemaining}</td>
          </tr>
        </tbody>
      </table>

      {circleData.length === 0 && (
        <div className="py-2 text-center text-white/40 text-[7px]">
          No data available
        </div>
      )}
    </div>
  )
}

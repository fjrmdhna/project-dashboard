"use client"

import { useMemo } from "react"
import { Trophy } from "lucide-react"
import { Row } from "./MatrixStatsCard"

export interface VendorLeaderboardCardProps {
  rows: Row[]
  isLoading?: boolean
}

export interface VendorScore {
  vendorName: string
  totalSites: number
  readinessCount: number
  activatedCount: number
  forecastCount: number
  readinessVsForecast: number
  activatedVsForecast: number
  aboveAccelerationActivated: number
  firstTimeRight: number // Manual input percentage
  totalScore: number
  rank: number
}

export function VendorLeaderboardCard({ rows, isLoading = false }: VendorLeaderboardCardProps) {
  // Calculate vendor scores with the 4 weighting rules
  const vendorScores = useMemo(() => {
    if (isLoading || !rows || rows.length === 0) {
      return []
    }

    // Group data by vendor
    const vendorData = new Map<string, {
      totalSites: number
      readinessCount: number
      activatedCount: number
      forecastCount: number
      readinessVsForecast: number
      activatedVsForecast: number
      aboveAccelerationActivated: number
    }>()

    rows.forEach(row => {
      if (!row.vendor_name) return

      const vendor = row.vendor_name
      if (!vendorData.has(vendor)) {
        vendorData.set(vendor, {
          totalSites: 0,
          readinessCount: 0,
          activatedCount: 0,
          forecastCount: 0,
          readinessVsForecast: 0,
          activatedVsForecast: 0,
          aboveAccelerationActivated: 0
        })
      }

      const data = vendorData.get(vendor)!
      data.totalSites++

      // Count readiness (imp_integ_af)
      if (row.imp_integ_af) {
        data.readinessCount++
      }

      // Count activated (rfs_af)
      if (row.rfs_af) {
        data.activatedCount++
      }

      // Count forecast (rfs_forecast_lock)
      if (row.rfs_forecast_lock) {
        data.forecastCount++
      }

      // Rule 1: Readiness vs Accelerate Plan (20% weight)
      // Compare imp_integ_af with mocn_activation_forecast
      // Since mocn_activation_forecast is not in our data, we'll use rfs_forecast_lock as proxy
      if (row.imp_integ_af && row.rfs_forecast_lock) {
        const readinessDate = new Date(row.imp_integ_af)
        const forecastDate = new Date(row.rfs_forecast_lock)
        if (readinessDate <= forecastDate) {
          data.readinessVsForecast++
        }
      }

      // Rule 2: Activated vs Accelerate Plan (50% weight)
      // Compare rfs_af with rfs_forecast_lock
      if (row.rfs_af && row.rfs_forecast_lock) {
        const activatedDate = new Date(row.rfs_af)
        const forecastDate = new Date(row.rfs_forecast_lock)
        if (activatedDate <= forecastDate) {
          data.activatedVsForecast++
        }
      }

      // Rule 3: Above Acceleration Activated (15% weight)
      // Calculate difference of rfs_af above rfs_forecast_lock
      if (row.rfs_af && row.rfs_forecast_lock) {
        const activatedDate = new Date(row.rfs_af)
        const forecastDate = new Date(row.rfs_forecast_lock)
        if (activatedDate < forecastDate) {
          const daysDiff = Math.ceil((forecastDate.getTime() - activatedDate.getTime()) / (1000 * 60 * 60 * 24))
          data.aboveAccelerationActivated += daysDiff
        }
      }
    })

    // Calculate scores for each vendor
    const scores: VendorScore[] = Array.from(vendorData.entries()).map(([vendorName, data]) => {
      // Manual First Time Right percentage (15% weight)
      // This should be configurable per vendor
      const firstTimeRightPercentage = getFirstTimeRightPercentage(vendorName)
      
      // Calculate weighted scores
      const readinessVsForecastScore = (data.readinessVsForecast / data.totalSites) * 20
      const activatedVsForecastScore = (data.activatedVsForecast / data.totalSites) * 50
      const aboveAccelerationScore = Math.min((data.aboveAccelerationActivated / data.totalSites) * 0.15, 15) // Cap at 15%
      const firstTimeRightScore = firstTimeRightPercentage * 15

      const totalScore = readinessVsForecastScore + activatedVsForecastScore + aboveAccelerationScore + firstTimeRightScore

      return {
        vendorName,
        totalSites: data.totalSites,
        readinessCount: data.readinessCount,
        activatedCount: data.activatedCount,
        forecastCount: data.forecastCount,
        readinessVsForecast: data.readinessVsForecast,
        activatedVsForecast: data.activatedVsForecast,
        aboveAccelerationActivated: data.aboveAccelerationActivated,
        firstTimeRight: firstTimeRightPercentage,
        totalScore: Math.round(totalScore * 100) / 100,
        rank: 0 // Will be set after sorting
      }
    })

    // Sort by total score (highest first) and assign ranks
    scores.sort((a, b) => b.totalScore - a.totalScore)
    scores.forEach((score, index) => {
      score.rank = index + 1
    })

    return scores
  }, [rows, isLoading])

  // Manual First Time Right percentages per vendor
  // This should ideally come from a configuration or database
  function getFirstTimeRightPercentage(vendorName: string): number {
    const firstTimeRightMap: Record<string, number> = {
      "Nokia Solutions and Networks Indonesia": 0.85, // 85%
      "Huawei Technologies Indonesia": 0.82, // 82%
      "Ericsson Indonesia": 0.88, // 88%
      "ZTE Indonesia": 0.80, // 80%
      "Samsung Electronics Indonesia": 0.75, // 75%
    }
    
    return firstTimeRightMap[vendorName] || 0.70 // Default 70%
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
          <div className="bg-yellow-500/20 p-1.5 rounded-lg">
            <Trophy className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="responsive-text-sm font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
            Vendor Leaderboard
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="bg-yellow-500/20 p-1.5 rounded-lg">
          <Trophy className="h-4 w-4 text-yellow-400" />
        </div>
        <div className="responsive-text-sm font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
          Vendor Leaderboard
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3">
          {vendorScores.slice(0, 10).map((vendor) => (
            <div key={vendor.vendorName} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors min-w-0">
              {/* Rank */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center responsive-text-sm font-bold"
                   style={{
                     backgroundColor: vendor.rank === 1 ? '#FFD700' : 
                                    vendor.rank === 2 ? '#C0C0C0' : 
                                    vendor.rank === 3 ? '#CD7F32' : '#4A5568',
                     color: vendor.rank <= 3 ? '#000000' : '#FFFFFF'
                   }}>
                {vendor.rank}
              </div>

              {/* Vendor Info */}
              <div className="flex-1 min-w-0">
                <div className="responsive-text font-medium text-white truncate">
                  {vendor.vendorName}
                </div>
                <div className="responsive-text-sm text-[#B0B7C3]">
                  {vendor.totalSites} sites • Score: {vendor.totalScore}%
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="flex-shrink-0 text-right">
                <div className="responsive-text-sm text-[#B0B7C3] space-y-1">
                  <div>R: {vendor.readinessCount}</div>
                  <div>A: {vendor.activatedCount}</div>
                  <div>F: {vendor.forecastCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {vendorScores.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/50">
            No vendor data available
          </div>
        )}
      </div>

      {/* Footer with scoring explanation */}
      <div className="mt-4 pt-3 border-t border-white/10 flex-shrink-0">
        <div className="responsive-text-sm text-[#B0B7C3] space-y-1">
          <div>Scoring: Readiness vs Forecast (20%) + Activated vs Forecast (50%) + Above Acceleration (15%) + First Time Right (15%)</div>
          <div>R: Readiness • A: Activated • F: Forecast</div>
        </div>
      </div>
    </div>
  )
}

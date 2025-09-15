"use client"

import { useMemo } from "react"
import { Trophy, Medal, Crown, Award } from "lucide-react"
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

  // Get vendor logo
  const getVendorLogo = (vendorName: string) => {
    if (vendorName.toLowerCase().includes('huawei')) {
      return '/Huawei_Standard_logo.svg.png'
    } else if (vendorName.toLowerCase().includes('nokia')) {
      return '/Nokia-Logo.png'
    } else if (vendorName.toLowerCase().includes('ericsson')) {
      return null // Will use icon fallback
    } else if (vendorName.toLowerCase().includes('zte')) {
      return null // Will use icon fallback
    } else if (vendorName.toLowerCase().includes('samsung')) {
      return null // Will use icon fallback
    }
    return null
  }

  // Get vendor icon fallback
  const getVendorIcon = (vendorName: string) => {
    if (vendorName.toLowerCase().includes('ericsson')) {
      return <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">E</div>
    } else if (vendorName.toLowerCase().includes('zte')) {
      return <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">Z</div>
    } else if (vendorName.toLowerCase().includes('samsung')) {
      return <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-[8px] font-bold">S</div>
    }
    return <Trophy className="h-3 w-3 text-white" />
  }

  // Podium component for top 3 vendors - Realistic design
  const PodiumDisplay = ({ vendors }: { vendors: VendorScore[] }) => {
    const top3 = vendors.slice(0, 3)
    
    return (
      <div className="flex items-end justify-center gap-1 mb-0 relative pt-3">
        {/* Podium Base */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 rounded-b-lg"></div>
        
        {/* 2nd Place - Left side */}
        {top3[1] ? (
          <div className="flex flex-col items-center relative z-10">
            {/* Podium Block */}
            <div className="w-10 h-16 bg-gradient-to-b from-gray-300 to-gray-500 rounded-t-lg flex flex-col items-center justify-center relative shadow-lg">
              {/* Rank Badge */}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">2</span>
              </div>
              {/* Logo */}
              <div className="w-5 h-5 flex items-center justify-center mb-1">
                {getVendorLogo(top3[1].vendorName) ? (
                  <img 
                    src={getVendorLogo(top3[1].vendorName)!} 
                    alt={top3[1].vendorName}
                    className="w-4 h-4 object-contain"
                  />
                ) : (
                  getVendorIcon(top3[1].vendorName)
                )}
              </div>
            </div>
            {/* Vendor Info */}
            <div className="text-center mt-1">
              <div className="text-[8px] text-white font-bold truncate max-w-[50px]">
                {top3[1].vendorName.split(' ')[0]}
              </div>
              <div className="text-[7px] text-blue-400 font-medium">
                {top3[1].totalScore}%
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center relative z-10">
            <div className="w-10 h-16 bg-gray-600 rounded-t-lg flex flex-col items-center justify-center relative shadow-lg">
              <div className="text-white/50 text-sm font-bold">-</div>
            </div>
            <div className="text-center mt-1">
              <div className="text-[8px] text-white/50 font-bold">No Data</div>
            </div>
          </div>
        )}
        
        {/* 1st Place - Center (tallest) */}
        {top3[0] ? (
          <div className="flex flex-col items-center relative z-20">
            {/* Crown */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-30">
              <Crown className="h-4 w-4 text-yellow-400 drop-shadow-lg" />
            </div>
            {/* Podium Block */}
            <div className="w-12 h-20 bg-gradient-to-b from-yellow-300 to-yellow-600 rounded-t-lg flex flex-col items-center justify-center relative shadow-xl">
              {/* Rank Badge */}
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-yellow-900">1</span>
              </div>
              {/* Logo */}
              <div className="w-6 h-6 flex items-center justify-center mb-1">
                {getVendorLogo(top3[0].vendorName) ? (
                  <img 
                    src={getVendorLogo(top3[0].vendorName)!} 
                    alt={top3[0].vendorName}
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  getVendorIcon(top3[0].vendorName)
                )}
              </div>
            </div>
            {/* Vendor Info */}
            <div className="text-center mt-1">
              <div className="text-[9px] text-white font-bold truncate max-w-[60px]">
                {top3[0].vendorName.split(' ')[0]}
              </div>
              <div className="text-[8px] text-yellow-400 font-bold">
                {top3[0].totalScore}%
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center relative z-20">
            <div className="w-12 h-20 bg-gray-600 rounded-t-lg flex flex-col items-center justify-center relative shadow-xl">
              <div className="text-white/50 text-sm font-bold">-</div>
            </div>
            <div className="text-center mt-1">
              <div className="text-[9px] text-white/50 font-bold">No Data</div>
            </div>
          </div>
        )}
        
        {/* 3rd Place - Right side */}
        {top3[2] ? (
          <div className="flex flex-col items-center relative z-10">
            {/* Podium Block */}
            <div className="w-8 h-12 bg-gradient-to-b from-amber-600 to-amber-800 rounded-t-lg flex flex-col items-center justify-center relative shadow-lg">
              {/* Rank Badge */}
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">3</span>
              </div>
              {/* Logo */}
              <div className="w-4 h-4 flex items-center justify-center mb-1">
                {getVendorLogo(top3[2].vendorName) ? (
                  <img 
                    src={getVendorLogo(top3[2].vendorName)!} 
                    alt={top3[2].vendorName}
                    className="w-3 h-3 object-contain"
                  />
                ) : (
                  getVendorIcon(top3[2].vendorName)
                )}
              </div>
            </div>
            {/* Vendor Info */}
            <div className="text-center mt-1">
              <div className="text-[8px] text-white font-bold truncate max-w-[45px]">
                {top3[2].vendorName.split(' ')[0]}
              </div>
              <div className="text-[7px] text-green-400 font-medium">
                {top3[2].totalScore}%
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center relative z-10">
            <div className="w-8 h-12 bg-gray-600 rounded-t-lg flex flex-col items-center justify-center relative shadow-lg">
              <div className="text-white/50 text-xs font-bold">-</div>
            </div>
            <div className="text-center mt-1">
              <div className="text-[8px] text-white/50 font-bold">No Data</div>
            </div>
          </div>
        )}
      </div>
    )
  }

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
      <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 p-1.5 w-full h-full flex flex-col min-w-0">
        <div className="flex items-center gap-1 mb-1.5 flex-shrink-0">
          <div className="bg-yellow-500/20 p-0.5 rounded-sm">
            <Trophy className="h-2.5 w-2.5 text-yellow-400" />
          </div>
          <div className="text-[8px] font-medium bg-yellow-500/20 text-yellow-300 px-1 py-0.5 rounded-full">
            Vendor Leaderboard
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 p-1.5 w-full h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1 mb-1.5 flex-shrink-0">
        <div className="bg-yellow-500/20 p-0.5 rounded-sm">
          <Trophy className="h-2.5 w-2.5 text-yellow-400" />
        </div>
        <div className="text-[8px] font-medium bg-yellow-500/20 text-yellow-300 px-1 py-0.5 rounded-full">
          Vendor Leaderboard
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Podium Display for Top 3 */}
        {vendorScores.length > 0 && (
          <div className="mb-0">
            <PodiumDisplay vendors={vendorScores} />
          </div>
        )}

        {/* Full Leaderboard List */}
        <div className="space-y-0">
          {vendorScores.slice(0, 10).map((vendor) => (
            <div key={vendor.vendorName} className={`flex items-center gap-0.5 p-0.5 rounded-sm transition-colors min-w-0 ${
              vendor.rank <= 3 
                ? 'bg-gradient-to-r from-white/10 to-white/5 border border-white/20' 
                : 'bg-white/5 hover:bg-white/10'
            }`}>
              {/* Rank with special styling for top 3 */}
              <div className="flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold"
                   style={{
                     backgroundColor: vendor.rank === 1 ? '#FFD700' : 
                                    vendor.rank === 2 ? '#C0C0C0' : 
                                    vendor.rank === 3 ? '#CD7F32' : '#4A5568',
                     color: vendor.rank <= 3 ? '#000000' : '#FFFFFF'
                   }}>
                {vendor.rank <= 3 ? (
                  vendor.rank === 1 ? <Crown className="h-1.5 w-1.5" /> :
                  vendor.rank === 2 ? <Medal className="h-1.5 w-1.5" /> :
                  <Award className="h-1.5 w-1.5" />
                ) : vendor.rank}
              </div>

              {/* Vendor Info */}
              <div className="flex-1 min-w-0">
                <div className={`text-[7px] font-medium truncate ${
                  vendor.rank <= 3 ? 'text-white font-bold' : 'text-white/90'
                }`}>
                  {vendor.vendorName}
                </div>
                <div className="text-[5px] text-[#B0B7C3]">
                  {vendor.totalSites} sites • {vendor.totalScore}%
                </div>
              </div>

              {/* Score Breakdown - Ultra Compact */}
              <div className="flex-shrink-0 text-right">
                <div className="text-[5px] text-[#B0B7C3]">
                  R:{vendor.readinessCount} A:{vendor.activatedCount}
                </div>
              </div>
            </div>
          ))}
        </div>

        {vendorScores.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
            No vendor data available
          </div>
        )}
      </div>

      {/* Footer with scoring explanation */}
      <div className="mt-1 pt-1 flex-shrink-0">
        <div className="text-[6px] text-[#B0B7C3] space-y-0.5">
          <div>Scoring: R vs F (20%) + A vs F (50%) + Above Accel (15%) + FTR (15%)</div>
          <div>R: Readiness • A: Activated • F: Forecast • FTR: First Time Right</div>
        </div>
      </div>
    </div>
  )
}

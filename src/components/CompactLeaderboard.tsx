"use client"

import { memo } from 'react'
import { Trophy, Medal, Award, Crown } from 'lucide-react'
import { VendorMetrics } from '@/types/leaderboard'
import { formatScore } from '@/lib/leaderboard-utils'

interface CompactLeaderboardProps {
  vendors: VendorMetrics[]
  loading?: boolean
}

const CompactLeaderboard = memo(function CompactLeaderboard({ 
  vendors = [], 
  loading = false 
}: CompactLeaderboardProps) {
  
  // Sort vendors by rank and take top 3
  const topVendors = [...vendors]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-[280px]">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h3 className="font-bold text-white text-sm">LEADERBOARD</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1: return 'h-10' // Tallest
      case 2: return 'h-8' // Medium
      case 3: return 'h-6' // Shortest
      default: return 'h-4'
    }
  }

  const getPodiumColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-t from-yellow-500 to-yellow-400'
      case 2: return 'bg-gradient-to-t from-gray-400 to-gray-300'
      case 3: return 'bg-gradient-to-t from-amber-600 to-amber-500'
      default: return 'bg-gradient-to-t from-blue-500 to-blue-400'
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-6 w-6 text-yellow-400" />
      case 2: return <Medal className="h-5 w-5 text-gray-400" />
      case 3: return <Award className="h-5 w-5 text-amber-600" />
      default: return null
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-2 h-[120px]">
      {/* Header */}
      <div className="flex items-center gap-1 mb-2">
        <Trophy className="h-3 w-3 text-yellow-400" />
        <h3 className="font-bold text-white text-xs">LEADERBOARD</h3>
      </div>

      {/* Podium Display */}
      <div className="flex items-end justify-center gap-2 h-20 mb-2">
        {topVendors.length >= 2 && (
          // 2nd Place
          <div className="flex flex-col items-center">
            <div className="text-center mb-1">
              <div className="w-6 h-6 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center mb-1">
                <Medal className="h-3 w-3 text-gray-400" />
              </div>
              <div className="text-white font-semibold text-[8px]">{topVendors[1].vendor_name}</div>
              <div className="text-gray-300 text-[8px]">{formatScore(topVendors[1].total_score)}</div>
            </div>
            <div className={`w-8 ${getPodiumHeight(2)} ${getPodiumColor(2)} rounded-t-md flex items-center justify-center`}>
              <span className="text-white font-bold text-xs">2</span>
            </div>
          </div>
        )}

        {topVendors.length >= 1 && (
          // 1st Place (Center, Taller)
          <div className="flex flex-col items-center">
            <div className="text-center mb-1">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-1 relative">
                <Crown className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="text-white font-bold text-[8px]">{topVendors[0].vendor_name}</div>
              <div className="text-yellow-300 text-[8px] font-semibold">{formatScore(topVendors[0].total_score)}</div>
            </div>
            <div className={`w-10 ${getPodiumHeight(1)} ${getPodiumColor(1)} rounded-t-md flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">1</span>
            </div>
          </div>
        )}

        {topVendors.length >= 3 && (
          // 3rd Place
          <div className="flex flex-col items-center">
            <div className="text-center mb-1">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center mb-1">
                <Award className="h-3 w-3 text-amber-600" />
              </div>
              <div className="text-white font-semibold text-[8px]">{topVendors[2].vendor_name}</div>
              <div className="text-amber-300 text-[8px]">{formatScore(topVendors[2].total_score)}</div>
            </div>
            <div className={`w-8 ${getPodiumHeight(3)} ${getPodiumColor(3)} rounded-t-md flex items-center justify-center`}>
              <span className="text-white font-bold text-xs">3</span>
            </div>
          </div>
        )}
      </div>

      {/* Additional Rankings */}
      {vendors.length > 3 && (
        <div className="space-y-1">
          <div className="text-[8px] text-gray-400 font-medium mb-1">Others:</div>
          {vendors.slice(3, 5).map((vendor) => (
            <div key={vendor.vendor_name} className="flex items-center justify-between text-[8px] bg-slate-700 rounded px-1 py-1">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                  {vendor.rank}
                </span>
                <span className="text-gray-300 truncate">{vendor.vendor_name.substring(0, 8)}</span>
              </div>
              <span className="text-blue-300 font-medium">{formatScore(vendor.total_score)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {topVendors.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <div className="text-xs">No leaderboard data</div>
        </div>
      )}
    </div>
  )
})

export { CompactLeaderboard } 
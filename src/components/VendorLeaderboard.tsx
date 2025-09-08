"use client"

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Edit3,
  Calendar,
  BarChart3,
  Crown,
  Star,
  Target
} from "lucide-react"
import { VendorMetrics, ScoreBreakdown } from '@/types/leaderboard'
import { 
  formatScore, 
  getRankBadgeColor, 
  getRankChangeDisplay,
  getScoreBreakdown,
  getCurrentWeek,
  getWeekDates
} from '@/lib/leaderboard-utils'
import { FTRInputModal } from './FTRInputModal'

interface VendorLeaderboardProps {
  vendors: VendorMetrics[]
  week?: number
  year?: number
  loading?: boolean
  onFTRUpdate?: (data: any[]) => void
}

export function VendorLeaderboard({
  vendors,
  week,
  year,
  loading = false,
  onFTRUpdate
}: VendorLeaderboardProps) {
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)
  const [showFTRModal, setShowFTRModal] = useState(false)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)

  const { week: currentWeek, year: currentYear } = getCurrentWeek()
  const activeWeek = week || currentWeek
  const activeYear = year || currentYear
  const weekDates = getWeekDates(activeWeek, activeYear)

  // Sort vendors by rank for display
  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => a.rank - b.rank)
  }, [vendors])

  // Get top 3 for podium display
  const topThree = sortedVendors.slice(0, 3)
  const restOfVendors = sortedVendors.slice(3)

  // Handle FTR modal save
  const handleFTRSave = async (data: any[]) => {
    if (onFTRUpdate) {
      await onFTRUpdate(data)
    }
    setShowFTRModal(false)
  }

  // Podium Component
  const PodiumDisplay = () => (
    <div className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 rounded-xl p-8 mb-6">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGRlZnM+CjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgo8cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9wYXR0ZXJuPgo8L2RlZnM+CjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiIC8+Cjwvc3ZnPg==')] opacity-20"></div>
      
      {/* Header */}
      <div className="relative text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="h-8 w-8 text-yellow-400" />
          <h2 className="text-3xl font-bold text-white">LEADERBOARD</h2>
          <Crown className="h-8 w-8 text-yellow-400" />
        </div>
        <p className="text-blue-200">
          Week {activeWeek}, {activeYear} • {weekDates.start} to {weekDates.end}
        </p>
      </div>

      {/* Podium Display */}
      <div className="relative flex items-end justify-center gap-4 h-64">
        {topThree.length >= 2 && (
          // 2nd Place (Silver)
          <div className="flex flex-col items-center">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center mb-2 ring-4 ring-gray-200">
                <Medal className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">{topThree[1].vendor_name}</h3>
              <p className="text-gray-200 text-sm">{formatScore(topThree[1].total_score)} pts</p>
              <Badge className="bg-gray-400 text-white mt-1">
                #2
              </Badge>
            </div>
            <div className="w-24 h-32 bg-gradient-to-t from-gray-400 to-gray-300 rounded-t-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">2</span>
            </div>
          </div>
        )}

        {topThree.length >= 1 && (
          // 1st Place (Gold) - Taller
          <div className="flex flex-col items-center">
            <div className="text-center mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-2 ring-4 ring-yellow-200 relative">
                <Trophy className="h-12 w-12 text-white" />
                <Star className="absolute -top-2 -right-2 h-6 w-6 text-yellow-300" />
              </div>
              <h3 className="text-white font-bold text-xl">{topThree[0].vendor_name}</h3>
              <p className="text-yellow-200 text-lg font-semibold">{formatScore(topThree[0].total_score)} pts</p>
              <Badge className="bg-yellow-500 text-white mt-1">
                👑 CHAMPION
              </Badge>
            </div>
            <div className="w-28 h-40 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg flex items-center justify-center">
              <span className="text-white font-bold text-3xl">1</span>
            </div>
          </div>
        )}

        {topThree.length >= 3 && (
          // 3rd Place (Bronze)
          <div className="flex flex-col items-center">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center mb-2 ring-4 ring-amber-200">
                <Award className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">{topThree[2].vendor_name}</h3>
              <p className="text-amber-200 text-sm">{formatScore(topThree[2].total_score)} pts</p>
              <Badge className="bg-amber-600 text-white mt-1">
                #3
              </Badge>
            </div>
            <div className="w-24 h-28 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">3</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Vendor Row Component
  const VendorRow = ({ vendor, index }: { vendor: VendorMetrics; index: number }) => {
    const rankChange = getRankChangeDisplay(vendor.rank_change)
    const breakdown = getScoreBreakdown(vendor)

    return (
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankBadgeColor(vendor.rank)}`}>
                {vendor.rank}
              </div>

              {/* Vendor Info */}
              <div>
                <h3 className="text-lg font-semibold">{vendor.vendor_name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Code: {vendor.vendor_code}</span>
                  <span className={`flex items-center gap-1 ${rankChange.color}`}>
                    <span>{rankChange.icon}</span>
                    <span>{rankChange.text}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Score Display */}
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {formatScore(vendor.total_score)}
              </div>
              <div className="text-sm text-muted-foreground">points</div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-blue-600">Implementation</div>
              <div className="text-xs text-muted-foreground">
                {breakdown.implementation.actual}/{breakdown.implementation.target}
              </div>
              <div className="font-semibold">{formatScore(breakdown.implementation.score)} pts</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-green-600">RFS</div>
              <div className="text-xs text-muted-foreground">
                {breakdown.rfs.actual}/{breakdown.rfs.target}
              </div>
              <div className="font-semibold">{formatScore(breakdown.rfs.score)} pts</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-purple-600">Timing</div>
              <div className="text-xs text-muted-foreground">
                {breakdown.timing.days_difference > 0 ? '+' : ''}{breakdown.timing.days_difference} days
              </div>
              <div className="font-semibold">{formatScore(breakdown.timing.bonus_score)} pts</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-orange-600">FTR</div>
              <div className="text-xs text-muted-foreground">
                {breakdown.ftr.percentage.toFixed(1)}%
              </div>
              <div className="font-semibold">{formatScore(breakdown.ftr.score)} pts</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-muted-foreground">Loading leaderboard...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Vendor Performance Leaderboard
              </CardTitle>
              <CardDescription>
                Ranking vendor berdasarkan implementasi, RFS, timing, dan FTR performance
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}>
                <BarChart3 className="h-4 w-4 mr-2" />
                {showScoreBreakdown ? 'Hide' : 'Show'} Details
              </Button>
              
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setShowFTRModal(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Input FTR
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Podium Display */}
      {topThree.length > 0 && <PodiumDisplay />}

      {/* Full Rankings */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Rankings</CardTitle>
          <CardDescription>
            Detailed breakdown untuk semua vendor (Week {activeWeek}, {activeYear})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedVendors.map((vendor, index) => (
            <VendorRow key={vendor.vendor_name} vendor={vendor} index={index} />
          ))}
          
          {sortedVendors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vendor data available for this week</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FTR Input Modal */}
      <FTRInputModal
        isOpen={showFTRModal}
        onClose={() => setShowFTRModal(false)}
        vendors={vendors.map(v => v.vendor_name)}
        currentWeek={activeWeek}
        currentYear={activeYear}
        onSave={handleFTRSave}
        existingData={[]} // TODO: Load existing FTR data
      />
    </div>
  )
} 
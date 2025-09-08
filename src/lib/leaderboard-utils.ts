import { VendorMetrics, ScoreBreakdown, LeaderboardWeek } from '@/types/leaderboard'

// Constants for scoring weights
export const SCORING_WEIGHTS = {
  IMPLEMENTATION: 0.20, // 20%
  RFS: 0.50, // 50%
  TIMING: 0.15, // 15%
  FTR: 0.15 // 15%
} as const

/**
 * Calculate implementation score based on actual vs forecast
 */
export function calculateImplementationScore(
  actual: number, 
  target: number
): { percentage: number; score: number } {
  if (target <= 0) return { percentage: 0, score: 0 }
  
  const percentage = (actual / target) * 100
  const score = percentage * SCORING_WEIGHTS.IMPLEMENTATION
  
  return { percentage, score }
}

/**
 * Calculate RFS score based on actual vs forecast lock
 */
export function calculateRFSScore(
  actual: number, 
  target: number
): { percentage: number; score: number } {
  if (target <= 0) return { percentage: 0, score: 0 }
  
  const percentage = (actual / target) * 100
  const score = percentage * SCORING_WEIGHTS.RFS
  
  return { percentage, score }
}

/**
 * Calculate timing bonus based on days difference
 * Positive days = ahead of schedule (bonus)
 * Negative days = behind schedule (penalty)
 */
export function calculateTimingBonus(daysDifference: number): number {
  return daysDifference * SCORING_WEIGHTS.TIMING
}

/**
 * Calculate FTR score from manual percentage input
 */
export function calculateFTRScore(ftrPercentage: number): number {
  return ftrPercentage * SCORING_WEIGHTS.FTR
}

/**
 * Calculate days difference between two dates
 */
export function calculateDaysDifference(
  actualDate?: string,
  forecastDate?: string
): number {
  if (!actualDate || !forecastDate) return 0
  
  const actual = new Date(actualDate)
  const forecast = new Date(forecastDate)
  
  // Positive = ahead of schedule, Negative = behind schedule
  const diffTime = forecast.getTime() - actual.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Calculate total vendor score with all components
 */
export function calculateVendorScore(vendor: Partial<VendorMetrics>): VendorMetrics {
  // Calculate days difference if dates are provided
  const daysDifference = calculateDaysDifference(vendor.rfs_date, vendor.forecast_date)
  
  // Calculate individual scores
  const implementation = calculateImplementationScore(
    vendor.imp_integ_af || 0,
    vendor.mocn_activation_forecast || 0
  )
  
  const rfs = calculateRFSScore(
    vendor.rfs_af || 0,
    vendor.forecast_lock || 0
  )
  
  const timingBonus = calculateTimingBonus(daysDifference)
  const ftrScore = calculateFTRScore(vendor.manual_ftr_percentage || 0)
  
  // Calculate total score
  const totalScore = implementation.score + rfs.score + timingBonus + ftrScore
  
  return {
    vendor_name: vendor.vendor_name || '',
    vendor_code: vendor.vendor_code || '',
    imp_integ_af: vendor.imp_integ_af || 0,
    mocn_activation_forecast: vendor.mocn_activation_forecast || 0,
    rfs_af: vendor.rfs_af || 0,
    forecast_lock: vendor.forecast_lock || 0,
    rfs_date: vendor.rfs_date,
    forecast_date: vendor.forecast_date,
    days_difference: daysDifference,
    manual_ftr_percentage: vendor.manual_ftr_percentage || 0,
    implementation_score: implementation.score,
    rfs_score: rfs.score,
    timing_bonus: timingBonus,
    ftr_score: ftrScore,
    total_score: totalScore,
    rank: 0, // Will be calculated when ranking
    previous_rank: vendor.previous_rank,
    rank_change: vendor.rank_change
  }
}

/**
 * Get detailed score breakdown for transparency
 */
export function getScoreBreakdown(vendor: VendorMetrics): ScoreBreakdown {
  const implementation = calculateImplementationScore(
    vendor.imp_integ_af,
    vendor.mocn_activation_forecast
  )
  
  const rfs = calculateRFSScore(
    vendor.rfs_af,
    vendor.forecast_lock
  )
  
  return {
    vendor_name: vendor.vendor_name,
    implementation: {
      actual: vendor.imp_integ_af,
      target: vendor.mocn_activation_forecast,
      percentage: implementation.percentage,
      score: implementation.score,
      weight: SCORING_WEIGHTS.IMPLEMENTATION * 100
    },
    rfs: {
      actual: vendor.rfs_af,
      target: vendor.forecast_lock,
      percentage: rfs.percentage,
      score: rfs.score,
      weight: SCORING_WEIGHTS.RFS * 100
    },
    timing: {
      days_difference: vendor.days_difference || 0,
      bonus_score: vendor.timing_bonus,
      weight: SCORING_WEIGHTS.TIMING * 100
    },
    ftr: {
      percentage: vendor.manual_ftr_percentage,
      score: vendor.ftr_score,
      weight: SCORING_WEIGHTS.FTR * 100
    },
    total_score: vendor.total_score
  }
}

/**
 * Rank vendors based on total score and assign rankings
 */
export function rankVendors(vendors: VendorMetrics[]): VendorMetrics[] {
  // Sort by total score (highest first)
  const sorted = [...vendors].sort((a, b) => b.total_score - a.total_score)
  
  // Assign ranks
  return sorted.map((vendor, index) => ({
    ...vendor,
    rank: index + 1,
    rank_change: calculateRankChange(vendor.rank, vendor.previous_rank)
  }))
}

/**
 * Calculate rank change indicator
 */
function calculateRankChange(
  currentRank: number, 
  previousRank?: number
): 'up' | 'down' | 'same' {
  if (!previousRank) return 'same'
  
  if (currentRank < previousRank) return 'up'
  if (currentRank > previousRank) return 'down'
  return 'same'
}

/**
 * Get current week number and year
 */
export function getCurrentWeek(): { week: number; year: number } {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000
  const week = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
  
  return {
    week,
    year: now.getFullYear()
  }
}

/**
 * Get week start and end dates
 */
export function getWeekDates(week: number, year: number): { start: string; end: string } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const ISOweekStart = simple
  
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  }
  
  const ISOweekEnd = new Date(ISOweekStart)
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6)
  
  return {
    start: ISOweekStart.toISOString().split('T')[0],
    end: ISOweekEnd.toISOString().split('T')[0]
  }
}

/**
 * Format score for display with proper decimal places
 */
export function formatScore(score: number, decimals: number = 2): string {
  return score.toFixed(decimals)
}

/**
 * Get rank badge color based on position
 */
export function getRankBadgeColor(rank: number): string {
  switch (rank) {
    case 1: return 'bg-yellow-500 text-white' // Gold
    case 2: return 'bg-gray-400 text-white' // Silver
    case 3: return 'bg-amber-600 text-white' // Bronze
    default: return 'bg-blue-500 text-white' // Default
  }
}

/**
 * Get rank change icon and color
 */
export function getRankChangeDisplay(change?: 'up' | 'down' | 'same'): {
  icon: string
  color: string
  text: string
} {
  switch (change) {
    case 'up':
      return { icon: '↗️', color: 'text-green-600', text: 'Naik' }
    case 'down':
      return { icon: '↘️', color: 'text-red-600', text: 'Turun' }
    default:
      return { icon: '→', color: 'text-gray-600', text: 'Tetap' }
  }
} 
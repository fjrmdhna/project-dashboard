// Types for Vendor Leaderboard System

export interface VendorMetrics {
  vendor_name: string
  vendor_code: string
  
  // Implementation metrics
  imp_integ_af: number // Actual implementation integration
  mocn_activation_forecast: number // Target/forecast activation
  
  // RFS metrics  
  rfs_af: number // Ready for Service actual
  forecast_lock: number // Forecast lock target
  
  // Timing metrics
  rfs_date?: string // Actual RFS date
  forecast_date?: string // Forecast date
  days_difference?: number // Calculated difference in days
  
  // Manual input
  manual_ftr_percentage: number // First Time Right percentage (manual input)
  
  // Calculated scores
  implementation_score: number // (imp_integ_af / mocn_activation_forecast) * 20%
  rfs_score: number // (rfs_af / forecast_lock) * 50%
  timing_bonus: number // days_difference * 15%
  ftr_score: number // manual_ftr_percentage * 15%
  total_score: number // Sum of all scores
  
  // Ranking
  rank: number
  previous_rank?: number
  rank_change?: 'up' | 'down' | 'same'
}

export interface LeaderboardWeek {
  week_number: number
  year: number
  week_start_date: string
  week_end_date: string
  vendors: VendorMetrics[]
  last_updated: string
}

export interface VendorPerformanceHistory {
  vendor_name: string
  weeks: Array<{
    week: number
    year: number
    score: number
    rank: number
  }>
}

export interface LeaderboardFilters {
  week?: number
  year?: number
  vendor?: string
  region?: string
}

export interface FTRInputData {
  vendor_name: string
  week_number: number
  year: number
  ftr_percentage: number
  notes?: string
  updated_by: string
  updated_at: string
}

// Score calculation breakdown for transparency
export interface ScoreBreakdown {
  vendor_name: string
  implementation: {
    actual: number
    target: number
    percentage: number
    score: number
    weight: number // 20%
  }
  rfs: {
    actual: number
    target: number
    percentage: number
    score: number
    weight: number // 50%
  }
  timing: {
    days_difference: number
    bonus_score: number
    weight: number // 15%
  }
  ftr: {
    percentage: number
    score: number
    weight: number // 15%
  }
  total_score: number
} 
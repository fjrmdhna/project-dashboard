import { NextRequest, NextResponse } from 'next/server'
import { VendorMetrics } from '@/types/leaderboard'
import { calculateVendorScore, rankVendors, getCurrentWeek } from '@/lib/leaderboard-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const week = parseInt(searchParams.get('week') || '0') || getCurrentWeek().week
    const year = parseInt(searchParams.get('year') || '0') || getCurrentWeek().year

    console.log('📊 Leaderboard API called for week:', week, 'year:', year)

    // Mock vendor data dengan metrics yang realistis
    const mockVendorData = [
      {
        vendor_name: 'NOKIA',
        vendor_code: 'NOK',
        imp_integ_af: 850,
        mocn_activation_forecast: 800,
        rfs_af: 720,
        forecast_lock: 750,
        rfs_date: '2024-01-15',
        forecast_date: '2024-01-20',
        manual_ftr_percentage: 92.5,
        previous_rank: 2
      },
      {
        vendor_name: 'HUAWEI',
        vendor_code: 'HW',
        imp_integ_af: 780,
        mocn_activation_forecast: 800,
        rfs_af: 680,
        forecast_lock: 700,
        rfs_date: '2024-01-18',
        forecast_date: '2024-01-16',
        manual_ftr_percentage: 88.0,
        previous_rank: 1
      },
      {
        vendor_name: 'ERICSSON',
        vendor_code: 'ERIC',
        imp_integ_af: 720,
        mocn_activation_forecast: 750,
        rfs_af: 650,
        forecast_lock: 680,
        rfs_date: '2024-01-22',
        forecast_date: '2024-01-20',
        manual_ftr_percentage: 85.5,
        previous_rank: 3
      },
      {
        vendor_name: 'ZTE',
        vendor_code: 'ZTE',
        imp_integ_af: 680,
        mocn_activation_forecast: 700,
        rfs_af: 590,
        forecast_lock: 620,
        rfs_date: '2024-01-25',
        forecast_date: '2024-01-22',
        manual_ftr_percentage: 82.0,
        previous_rank: 4
      },
      {
        vendor_name: 'SAMSUNG',
        vendor_code: 'SAM',
        imp_integ_af: 640,
        mocn_activation_forecast: 680,
        rfs_af: 560,
        forecast_lock: 580,
        rfs_date: '2024-01-28',
        forecast_date: '2024-01-24',
        manual_ftr_percentage: 79.5,
        previous_rank: 5
      }
    ]

    // Calculate scores untuk setiap vendor
    const vendorsWithScores = mockVendorData.map(vendorData => 
      calculateVendorScore(vendorData)
    )

    // Rank vendors berdasarkan total score
    const rankedVendors = rankVendors(vendorsWithScores)

    console.log('🏆 Calculated vendor rankings:', rankedVendors.map(v => ({
      name: v.vendor_name,
      score: v.total_score,
      rank: v.rank
    })))

    // Calculate additional statistics
    const stats = {
      total_vendors: rankedVendors.length,
      average_score: rankedVendors.reduce((sum, v) => sum + v.total_score, 0) / rankedVendors.length,
      highest_score: Math.max(...rankedVendors.map(v => v.total_score)),
      lowest_score: Math.min(...rankedVendors.map(v => v.total_score)),
      week_number: week,
      year: year
    }

    return NextResponse.json({
      success: true,
      data: {
        vendors: rankedVendors,
        stats: stats,
        week: week,
        year: year,
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error in vendor leaderboard API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch vendor leaderboard data',
        data: {
          vendors: [],
          stats: null,
          week: getCurrentWeek().week,
          year: getCurrentWeek().year
        }
      },
      { status: 500 }
    )
  }
}

// Handle FTR data updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ftr_data, week, year } = body

    console.log('💾 Saving FTR data:', { ftr_data, week, year })

    // TODO: Implement actual database save
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: 'FTR data saved successfully',
      data: {
        saved_count: ftr_data?.length || 0,
        week: week,
        year: year,
        saved_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error saving FTR data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save FTR data'
      },
      { status: 500 }
    )
  }
} 
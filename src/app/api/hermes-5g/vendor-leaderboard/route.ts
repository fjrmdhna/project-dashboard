import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    
    // Use Supabase to get site data
    const { data } = await getSiteData5G({
      vendor_name: vendorNames.length > 0 ? vendorNames : undefined,
      program_report: programReports.length > 0 ? programReports : undefined,
      imp_ttp: impTtps.length > 0 ? impTtps : undefined,
      search: q || undefined,
      limit: 10000
    })
    
    // Group data by vendor and calculate scores
    const vendorData = new Map<string, {
      totalSites: number
      readinessCount: number
      activatedCount: number
      forecastCount: number
    }>()

    data.forEach(row => {
      if (!row.vendor_name) return

      const vendor = row.vendor_name
      if (!vendorData.has(vendor)) {
        vendorData.set(vendor, {
          totalSites: 0,
          readinessCount: 0,
          activatedCount: 0,
          forecastCount: 0
        })
      }

      const vendorInfo = vendorData.get(vendor)!
      vendorInfo.totalSites++

      if (row.imp_integ_af) vendorInfo.readinessCount++
      if (row.rfs_af) vendorInfo.activatedCount++
      if (row.rfs_forecast_lock) vendorInfo.forecastCount++
    })

    // Calculate scores for each vendor
    const vendorScores = Array.from(vendorData.entries()).map(([vendorName, data]) => {
      const firstTimeRightPercentage = getFirstTimeRightPercentage(vendorName)
      
      const readinessScore = (data.readinessCount / data.totalSites) * 20
      const activatedScore = (data.activatedCount / data.totalSites) * 50
      const forecastScore = (data.forecastCount / data.totalSites) * 15
      const firstTimeRightScore = firstTimeRightPercentage * 15

      const totalScore = readinessScore + activatedScore + forecastScore + firstTimeRightScore

      return {
        vendorName,
        totalSites: data.totalSites,
        readinessCount: data.readinessCount,
        activatedCount: data.activatedCount,
        forecastCount: data.forecastCount,
        readinessVsForecast: 0,
        activatedVsForecast: 0,
        aboveAccelerationActivated: 0,
        firstTimeRight: firstTimeRightPercentage,
        totalScore: Math.round(totalScore * 100) / 100,
        rank: 0
      }
    })

    // Sort by total score (highest first) and assign ranks
    vendorScores.sort((a, b) => b.totalScore - a.totalScore)
    vendorScores.forEach((score, index) => {
      score.rank = index + 1
    })
    
    return NextResponse.json({
      status: 'success',
      data: vendorScores,
      timestamp: new Date().toISOString(),
      filtered: vendorNames.length > 0 || programReports.length > 0 || impTtps.length > 0 || q.length > 0,
      totalVendors: vendorScores.length
    })
  } catch (error) {
    console.error('Error fetching vendor leaderboard data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch vendor leaderboard data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
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
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

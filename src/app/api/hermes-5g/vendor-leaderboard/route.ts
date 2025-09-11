import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// PostgreSQL Pool
const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'project_dashboard',
  user: process.env.POSTGRES_USER || 'project_user',
  password: process.env.POSTGRES_PASSWORD || 'projectpassword',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    
    // Prepare query dan parameter
    let queryParams: any[] = []
    let paramIndex = 1
    let whereConditions: string[] = []
    
    // Search filter (q)
    if (q) {
      whereConditions.push(`(
        LOWER(system_key) LIKE LOWER($${paramIndex}) OR
        LOWER(site_id) LIKE LOWER($${paramIndex}) OR
        LOWER(site_name) LIKE LOWER($${paramIndex}) OR
        LOWER(vendor_name) LIKE LOWER($${paramIndex})
      )`)
      queryParams.push(`%${q}%`)
      paramIndex++
    }
    
    // Vendor name filter
    if (vendorNames.length > 0) {
      const placeholders = vendorNames.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`vendor_name IN (${placeholders})`)
      queryParams.push(...vendorNames)
      paramIndex += vendorNames.length
    }
    
    // Program report filter
    if (programReports.length > 0) {
      const placeholders = programReports.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`program_report IN (${placeholders})`)
      queryParams.push(...programReports)
      paramIndex += programReports.length
    }
    
    // imp_ttp filter
    if (impTtps.length > 0) {
      const placeholders = impTtps.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`imp_ttp IN (${placeholders})`)
      queryParams.push(...impTtps)
      paramIndex += impTtps.length
    }
    
    // Build WHERE clause
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')} AND vendor_name IS NOT NULL` 
      : 'WHERE vendor_name IS NOT NULL'
    
    
    // Query database untuk vendor leaderboard
    const client = await postgresPool.connect()
    
    try {
      const query = `
        SELECT 
          vendor_name,
          COUNT(*) as total_sites,
          COUNT(CASE WHEN imp_integ_af IS NOT NULL THEN 1 END) as readiness_count,
          COUNT(CASE WHEN rfs_af IS NOT NULL THEN 1 END) as activated_count,
          COUNT(CASE WHEN rfs_forecast_lock IS NOT NULL THEN 1 END) as forecast_count
        FROM site_data_5g
        ${whereClause}
        GROUP BY vendor_name
        HAVING COUNT(*) > 0
        ORDER BY total_sites DESC
      `
      
      const result = await client.query(query, queryParams)
      
      // Process results and calculate scores
      const vendorScores = result.rows.map((row, index) => {
        const totalSites = parseInt(row.total_sites)
        const readinessCount = parseInt(row.readiness_count)
        const activatedCount = parseInt(row.activated_count)
        const forecastCount = parseInt(row.forecast_count)
        
        // Simplified scoring for now - we'll calculate the complex rules in the frontend
        // Manual First Time Right percentage (15% weight)
        const firstTimeRightPercentage = getFirstTimeRightPercentage(row.vendor_name)
        
        // Calculate basic weighted scores
        const readinessScore = (readinessCount / totalSites) * 20
        const activatedScore = (activatedCount / totalSites) * 50
        const forecastScore = (forecastCount / totalSites) * 15
        const firstTimeRightScore = firstTimeRightPercentage * 15

        const totalScore = readinessScore + activatedScore + forecastScore + firstTimeRightScore

        return {
          vendorName: row.vendor_name,
          totalSites,
          readinessCount,
          activatedCount,
          forecastCount,
          readinessVsForecast: 0, // Will be calculated in frontend
          activatedVsForecast: 0, // Will be calculated in frontend
          aboveAccelerationActivated: 0, // Will be calculated in frontend
          firstTimeRight: firstTimeRightPercentage,
          totalScore: Math.round(totalScore * 100) / 100,
          rank: index + 1
        }
      })

      // Sort by total score (highest first) and reassign ranks
      vendorScores.sort((a, b) => b.totalScore - a.totalScore)
      vendorScores.forEach((score, index) => {
        score.rank = index + 1
      })
      
      return NextResponse.json({
        status: 'success',
        data: vendorScores,
        timestamp: new Date().toISOString(),
        filtered: whereConditions.length > 0,
        totalVendors: vendorScores.length
      })
    } finally {
      client.release()
    }
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

import { NextRequest, NextResponse } from 'next/server'
import { getNanoClusterData } from '@/lib/hermes-5g-utils'
import { parseFilterParams } from '@/lib/filters'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const url = new URL(request.url)
    const { vendorNames, programReports, impTtps } = parseFilterParams(url)
    const data = await getNanoClusterData({
      vendorNames,
      programReports,
      impTtps
    })
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching nano cluster data:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch nano cluster data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 

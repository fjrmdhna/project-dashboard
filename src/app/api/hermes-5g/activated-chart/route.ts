import { NextRequest, NextResponse } from 'next/server'
import { getActivatedChartData } from '@/lib/hermes-5g-utils'
import { parseFilterParams } from '@/lib/filters'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const url = new URL(request.url)
    const { vendorNames, programReports, impTtps } = parseFilterParams(url)
    const result = await getActivatedChartData({
      vendorNames,
      programReports,
      impTtps
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in activated chart API:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch activated chart data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 

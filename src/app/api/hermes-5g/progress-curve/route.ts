import { NextRequest, NextResponse } from 'next/server'
import { getProgressCurveData } from '@/lib/hermes-5g-utils'
import { parseFilterParams } from '@/lib/filters'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const url = new URL(request.url)
    const { vendorNames, programReports, impTtps } = parseFilterParams(url)
    const result = await getProgressCurveData({
      vendorNames,
      programReports,
      impTtps
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in progress curve API:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch progress curve data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 

import { NextRequest, NextResponse } from 'next/server'
import { getDataAlignmentData } from '@/lib/hermes-5g-utils'
import { parseFilterParams } from '@/lib/filters'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const url = new URL(request.url)
    const { vendorNames, programReports, impTtps } = parseFilterParams(url)
    const data = await getDataAlignmentData({
      vendorNames,
      programReports,
      impTtps
    })
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching data alignment data:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch data alignment data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 

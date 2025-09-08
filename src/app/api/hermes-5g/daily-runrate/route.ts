import { NextRequest, NextResponse } from 'next/server'
import { getDailyRunrateData } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const vendorFilter = searchParams.get('vendorFilter') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'
    
    const result = await getDailyRunrateData({
      vendorFilter,
      programFilter,
      cityFilter
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in daily runrate API:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch daily runrate data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 
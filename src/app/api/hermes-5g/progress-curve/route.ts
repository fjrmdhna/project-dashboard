import { NextRequest, NextResponse } from 'next/server'
import { getProgressCurveData } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const vendorFilter = searchParams.get('vendorFilter') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'
    
    const result = await getProgressCurveData({
      vendorFilter,
      programFilter,
      cityFilter
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
import { NextRequest, NextResponse } from 'next/server'
import { getDataAlignmentData } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const vendorFilter = searchParams.get('vendorFilter') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'
    
    const data = await getDataAlignmentData({
      vendorFilter,
      programFilter,
      cityFilter
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
import { NextRequest, NextResponse } from 'next/server'
import { getFilterOptions } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    const data = await getFilterOptions()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch filter options',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 
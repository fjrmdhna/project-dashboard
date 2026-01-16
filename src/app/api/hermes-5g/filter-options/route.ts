import { NextRequest, NextResponse } from 'next/server'
import { getFilterOptions } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    const result = await getFilterOptions()
    
    if (result.status === 'error') {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Failed to fetch filter options',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        vendors: result.data.vendors,
        programs: result.data.programs,
        cities: result.data.cities,
        nanoClusters: result.data.nanoClusters,
        regions: result.data.regions,
        ranScores: result.data.ranScores,
      },
      timestamp: result.timestamp,
    })
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
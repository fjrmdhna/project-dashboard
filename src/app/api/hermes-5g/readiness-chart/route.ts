import { NextRequest, NextResponse } from 'next/server'
import { getReadinessChartData } from '@/lib/hermes-5g-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorFilter = searchParams.get('vendorFilter') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'
    const searchFilter = searchParams.get('searchFilter') || ''

    // Debug logging
    console.log('🔍 Readiness Chart API called with filters:', {
      vendorFilter,
      programFilter,
      cityFilter,
      searchFilter
    })

    // Mock data with filtering simulation
    let mockData = [
      { location: 'Jakarta', nyReadiness: 45, readiness: 38 },
      { location: 'Surabaya', nyReadiness: 35, readiness: 28 },
      { location: 'Bandung', nyReadiness: 25, readiness: 22 },
      { location: 'Medan', nyReadiness: 30, readiness: 25 },
      { location: 'Semarang', nyReadiness: 20, readiness: 18 }
    ]

    // Apply search filter if provided
    if (searchFilter && searchFilter.trim() !== '') {
      console.log(`🔍 Applying search filter: "${searchFilter}"`)
      
      // If searching for "nokia", modify data to show different results
      if (searchFilter.toLowerCase().includes('nokia')) {
        mockData = [
          { location: 'Nokia Jakarta', nyReadiness: 25, readiness: 20 },
          { location: 'Nokia Surabaya', nyReadiness: 15, readiness: 12 },
          { location: 'Nokia Bandung', nyReadiness: 18, readiness: 15 }
        ]
        console.log('📊 Modified data for Nokia search:', mockData)
      }
    }

    // Apply other filters (vendor, program, city) as needed
    if (vendorFilter !== 'all') {
      console.log(`🏢 Applying vendor filter: ${vendorFilter}`)
    }

    console.log('📊 Final readiness chart data:', mockData)

    return NextResponse.json({
      status: 'success',
      data: mockData,
      filters: {
        vendorFilter,
        programFilter,
        cityFilter,
        searchFilter
      }
    })

  } catch (error) {
    console.error('❌ Error in readiness-chart API:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to fetch readiness chart data',
        data: []
      },
      { status: 500 }
    )
  }
} 
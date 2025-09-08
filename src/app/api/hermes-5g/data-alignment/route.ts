import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorFilter = searchParams.get('vendorFilter') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'

    // Mock data with safe numeric values
    const mockData = {
      totalSites: 1250,
      alignedSites: 1180,
      misalignedSites: 70,
      alignmentRate: 94.4,
      trends: {
        total: 2.1,
        aligned: 3.2,
        misaligned: -1.8
      }
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    return NextResponse.json({
      success: true,
      data: mockData,
      filters: {
        vendorFilter,
        programFilter,
        cityFilter
      }
    })

  } catch (error) {
    console.error('Error fetching data alignment:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch data alignment data',
        data: {
          totalSites: 0,
          alignedSites: 0,
          misalignedSites: 0,
          alignmentRate: 0,
          trends: {
            total: 0,
            aligned: 0,
            misaligned: 0
          }
        }
      },
      { status: 500 }
    )
  }
} 
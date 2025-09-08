import { NextResponse } from 'next/server'
import { getHermes5GData, getFilterOptions, PaginationParams } from '@/lib/hermes-5g-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || 'all'
    const regionFilter = searchParams.get('regionFilter') || searchParams.get('region') || 'all'
    const vendorFilter = searchParams.get('vendorFilter') || searchParams.get('vendor') || 'all'
    const programFilter = searchParams.get('programFilter') || 'all'
    const cityFilter = searchParams.get('cityFilter') || 'all'
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Validate parameters
    if (page < 1) throw new Error('Page must be greater than 0')
    if (pageSize < 1 || pageSize > 100) throw new Error('Page size must be between 1 and 100')

    // Build pagination params
    const paginationParams: PaginationParams = {
      page,
      pageSize,
      search,
      statusFilter,
      regionFilter,
      vendorFilter,
      programFilter,
      cityFilter,
      sortBy,
      sortOrder
    }

    // Get data from database
    const result = await getHermes5GData(paginationParams)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error fetching Hermes 5G data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch Hermes 5G data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 
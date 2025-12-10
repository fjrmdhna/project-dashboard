import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { SiteDataTLP } from '@/lib/supabase'
import { requireApiKey } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    // Validate API key
    const authError = requireApiKey(request)
    if (authError) {
      return authError
    }
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || ''
    const regionFilter = searchParams.get('regionFilter') || searchParams.get('region') || 'all'
    const vendorFilter = searchParams.get('vendorFilter') || searchParams.get('vendor') || 'all'
    const programFilter = searchParams.get('programFilter') || searchParams.get('program') || 'all'
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Validate parameters
    if (page < 1) throw new Error('Page must be greater than 0')
    if (pageSize < 1 || pageSize > 100) throw new Error('Page size must be between 1 and 100')

    // Build query
    let query = supabase
      .from('site_data_tlp')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(
        `system_key.ilike.%${search}%,site_id.ilike.%${search}%,site_name.ilike.%${search}%,vendor_code.ilike.%${search}%,project_name.ilike.%${search}%`
      )
    }

    // Apply region filter
    if (regionFilter && regionFilter !== 'all') {
      query = query.eq('region', regionFilter)
    }

    // Apply vendor filter
    if (vendorFilter && vendorFilter !== 'all') {
      query = query.eq('vendor_code', vendorFilter)
    }

    // Apply program filter
    if (programFilter && programFilter !== 'all') {
      query = query.eq('program_name', programFilter)
    }

    // Apply sorting
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      console.error('Supabase Error:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    const totalRecords = count || 0
    const totalPages = Math.ceil(totalRecords / pageSize)

    return NextResponse.json({
      status: 'success',
      data: data as SiteDataTLP[],
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error fetching TLP data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch TLP data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


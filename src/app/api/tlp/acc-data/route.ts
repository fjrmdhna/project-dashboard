import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { SiteDataTLP } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorCodes = searchParams.getAll('vendor_code') || []
    const programNames = searchParams.getAll('program_name') || []
    const regions = searchParams.getAll('region') || []
    
    // Select columns yang diperlukan untuk ACC chart
    const columns = [
      'system_key',
      'ic_000010_ff', // PLAN RFI ACC
      'ic_000010_af', // ACTUAL RFI ACC
      'rfi_accepted', // ACTUAL CRFI ACC
      'vendor_code',
      'program_name',
      'region'
    ].join(',')
    
    // Query site_data_tlp table
    let allData: any[] = []
    let hasMore = true
    let page = 0
    const pageSize = 1000 // Supabase max per page
    
    // Build base query
    let baseQuery = supabase
      .from('site_data_tlp')
      .select(columns, { count: 'exact' })
    
    // Apply filters
    if (vendorCodes.length > 0) {
      baseQuery = baseQuery.in('vendor_code', vendorCodes)
    }
    
    if (programNames.length > 0) {
      baseQuery = baseQuery.in('program_name', programNames)
    }
    
    if (regions.length > 0) {
      baseQuery = baseQuery.in('region', regions)
    }

    if (q) {
      baseQuery = baseQuery.or(
        `system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_code.ilike.%${q}%,project_name.ilike.%${q}%`
      )
    }
    
    // Fetch all data using pagination
    let totalCount = 0
    let error: any = null
    
    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      
      const query = baseQuery.range(from, to)
      const { data: pageData, error: pageError, count } = await query
      
      if (pageError) {
        error = pageError
        break
      }
      
      if (count !== null && totalCount === 0) {
        totalCount = count
      }
      
      if (pageData && pageData.length > 0) {
        allData = [...allData, ...pageData]
        hasMore = pageData.length === pageSize
        page++
      } else {
        hasMore = false
      }
      
      // Safety check to prevent infinite loop
      if (page > 50) {
        console.warn('Pagination limit reached, stopping at page', page)
        break
      }
    }
    
    const data = allData
    const count = totalCount
    
    // If table doesn't exist or error, return empty data
    if (error) {
      if (error.code === 'PGRST116') {
        // Table doesn't exist, return empty data
        return NextResponse.json({
          status: 'success',
          data: [],
          count: 0,
          timestamp: new Date().toISOString()
        })
      }
      throw new Error(`Database error: ${error.message}`)
    }
    
    return NextResponse.json({
      status: 'success',
      data: data as SiteDataTLP[],
      count: data.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching TLP ACC data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch TLP ACC data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}


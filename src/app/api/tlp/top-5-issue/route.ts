import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Warna untuk kategori issue
const ISSUE_COLORS = [
  '#FF6B6B', // Merah
  '#F7B267', // Orange
  '#4ECDC4', // Teal/Cyan
  '#5DA3FA', // Biru
  '#C792EA', // Ungu
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter TLP
    const q = searchParams.get('q') || ''
    const vendorCodes = searchParams.getAll('vendor_code') || []
    const programNames = searchParams.getAll('program_name') || []
    const regions = searchParams.getAll('region') || []
    
    // Build Supabase query with filters - optimized: only select issue_ny_sc column
    let query = supabase
      .from('site_data_tlp')
      .select('issue_ny_sc', { count: 'exact' }) // Only select needed column, get count for total
      .not('issue_ny_sc', 'is', null)
      .neq('issue_ny_sc', '')
    
    // Filter out excluded categories at query level to reduce data processing
    query = query
      .not('issue_ny_sc', 'ilike', '%no issue%')
      .not('issue_ny_sc', 'ilike', '%caf ny submit%')
    
    // Apply filters (multi-value support)
    if (q) {
      query = query.or(
        `system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_code.ilike.%${q}%,project_name.ilike.%${q}%,issue_ny_sc.ilike.%${q}%`
      )
    }
    if (vendorCodes.length > 0) {
      query = query.in('vendor_code', vendorCodes)
    }
    if (programNames.length > 0) {
      query = query.in('program_name', programNames)
    }
    if (regions.length > 0) {
      query = query.in('region', regions)
    }
    
    // Get data from Supabase
    const { data, error, count } = await query
    
    if (error) {
      console.error('Supabase Error:', error)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to fetch top 5 issue data',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
    
    // Process data to count issue categories (optimized: excluded categories already filtered at query level)
    const categoryCount: { [key: string]: number } = {}
    data?.forEach(row => {
      if (row.issue_ny_sc) {
        categoryCount[row.issue_ny_sc] = (categoryCount[row.issue_ny_sc] || 0) + 1
      }
    })
    
    // Sort by count and get top 5 categories (excluded categories already filtered at query level)
    const sortedCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    
    // Add colors to the data
    const result = sortedCategories.map(([category, count], index) => ({
      category,
      count,
      color: ISSUE_COLORS[index % ISSUE_COLORS.length]
    }))
    
    // Calculate totals (use count from query if available, otherwise fallback to data length)
    const totalCount = count || data?.length || 0
    const top5Count = result.reduce((sum, item) => sum + item.count, 0)
    const filteredTotalCount = Object.values(categoryCount).reduce((sum, count) => sum + count, 0)
    
    // Debug logging
    console.log('TLP Top 5 Issue API Debug:', {
      filter: { q, vendorCodes, programNames, regions },
      totalRecords: data?.length || 0,
      categoryCount,
      sortedCategories,
      result: result.map(r => ({ category: r.category, count: r.count })),
      top5Count,
      filteredTotalCount,
      totalCount
    })
    
    return NextResponse.json({
      status: 'success',
      data: result,
      top5Count,
      filteredTotalCount,
      totalCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching TLP top 5 issue data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch top 5 issue data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}


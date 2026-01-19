import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Warna untuk kategori issue
const ISSUE_COLORS = [
  '#FF6B6B', // Merah
  '#F7B267', // Orange
  '#4ECDC4', // Teal/Cyan
  '#5DA3FA', // Biru
  '#C792EA', // Ungu
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters untuk filter AOP
    const q = searchParams.get('q') || '';
    const vendorNames = searchParams.getAll('vendor_name') || [];
    const programReports = searchParams.getAll('program_report') || [];
    const circles = searchParams.getAll('region_circle') || [];
    const siteCategories = searchParams.getAll('site_category') || [];
    
    // Build Supabase query with filters - optimized: only select issue_category column
    let query = supabase
      .from('site_data_aop')
      .select('issue_category', { count: 'exact' }) // Only select needed column, get count for total
      .not('issue_category', 'is', null)
      .neq('issue_category', '');
    
    // Filter out excluded categories at query level to reduce data processing
    query = query
      .not('issue_category', 'ilike', '%no issue%')
      .not('issue_category', 'ilike', '%caf ny submit%')
      .not('issue_category', 'ilike', '%20. 5g activation done%')
      .not('issue_category', 'ilike', '%18c. 5g integration done%');
    
    // Apply filters (multi-value support)
    if (q) {
      query = query.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%,issue_category.ilike.%${q}%`);
    }
    if (vendorNames.length > 0) {
      query = query.in('vendor_name', vendorNames);
    }
    if (programReports.length > 0) {
      query = query.in('program_report', programReports);
    }
    // Region circle filter - use case-insensitive matching to handle data variations
    if (circles.length > 0) {
      const circleConditions = circles
        .map(c => {
          const normalized = c.trim().toLowerCase()
          return `region_circle.ilike.${normalized}`
        })
        .join(',')
      query = query.or(circleConditions)
    }
    // Site category filter - use case-insensitive matching to handle data variations
    // Database may have: "existing", "Existing", "Existing " (with trailing space), etc.
    if (siteCategories.length > 0) {
      const siteCategoryConditions = siteCategories
        .map(sc => {
          const normalized = sc.trim().toLowerCase()
          return `site_category.ilike.${normalized}`
        })
        .join(',')
      query = query.or(siteCategoryConditions)
    }
    
    // Get data from Supabase
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to fetch top 5 issue data',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
    
    // Process data to count issue categories (optimized: excluded categories already filtered at query level)
    const categoryCount: { [key: string]: number } = {};
    data?.forEach(row => {
      if (row.issue_category) {
        categoryCount[row.issue_category] = (categoryCount[row.issue_category] || 0) + 1;
      }
    });
    
    // Sort by count and get top 5 categories (excluded categories already filtered at query level)
    const sortedCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    // Add colors to the data
    const result = sortedCategories.map(([category, count], index) => ({
      category,
      count,
      color: ISSUE_COLORS[index % ISSUE_COLORS.length]
    }));
    
    // Calculate totals (use count from query if available, otherwise fallback to data length)
    const totalCount = count || data?.length || 0;
    const top5Count = result.reduce((sum, item) => sum + item.count, 0);
    const filteredTotalCount = Object.values(categoryCount).reduce((sum, count) => sum + count, 0);
    
    // Debug logging
    console.log('AOP Top 5 Issue API Debug:', {
      filter: { q, vendorNames, programReports, circles },
      totalRecords: data?.length || 0,
      categoryCount,
      sortedCategories,
      result: result.map(r => ({ category: r.category, count: r.count })),
      top5Count,
      filteredTotalCount,
      totalCount
    });
    
    return NextResponse.json({
      status: 'success',
      data: result,
      top5Count,
      filteredTotalCount,
      totalCount,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('Error fetching AOP top 5 issue data:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch top 5 issue data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}


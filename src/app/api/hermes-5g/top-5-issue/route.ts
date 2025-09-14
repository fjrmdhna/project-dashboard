import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Warna untuk kategori issue
const ISSUE_COLORS = [
  '#F6C945', // Kuning
  '#E74C3C', // Merah
  '#8A5AA3', // Ungu
  '#7CB342', // Hijau
  '#4AA3DF', // Biru
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const vendorFilter = searchParams.get('vendorFilter') || 'all';
    const programFilter = searchParams.get('programFilter') || 'all';
    const cityFilter = searchParams.get('cityFilter') || 'all';
    const searchFilter = searchParams.get('searchFilter') || '';
    
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('issue_category')
      .not('issue_category', 'is', null)
      .neq('issue_category', '');
    
    // Apply filters
    if (searchFilter) {
      query = query.or(`system_key.ilike.%${searchFilter}%,site_id.ilike.%${searchFilter}%,site_name.ilike.%${searchFilter}%,vendor_name.ilike.%${searchFilter}%,issue_category.ilike.%${searchFilter}%`);
    }
    
    if (vendorFilter && vendorFilter !== 'all') {
      query = query.eq('vendor_name', vendorFilter);
    }
    
    if (programFilter && programFilter !== 'all') {
      query = query.eq('program_report', programFilter);
    }
    
    if (cityFilter && cityFilter !== 'all') {
      query = query.eq('imp_ttp', cityFilter);
    }
    
    // Get data from Supabase
    const { data, error } = await query;
    
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
    
    // Process data to count issue categories
    const categoryCount: { [key: string]: number } = {};
    data?.forEach(row => {
      if (row.issue_category) {
        categoryCount[row.issue_category] = (categoryCount[row.issue_category] || 0) + 1;
      }
    });
    
    // Sort by count and get top 5
    const sortedCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    // Add colors to the data
    const result = sortedCategories.map(([category, count], index) => ({
      category,
      count,
      color: ISSUE_COLORS[index % ISSUE_COLORS.length]
    }));
    
    // Calculate totals
    const totalCount = data?.length || 0;
    const top5Count = result.reduce((sum, item) => sum + item.count, 0);
    
    return NextResponse.json({
      status: 'success',
      data: result,
      top5Count,
      totalCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching top 5 issue data:', error);
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
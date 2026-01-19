import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';

// Interface untuk date record
interface DateRecord {
  date: Date;
  formatted: string;
  sqlDate: string;
}

// Interface untuk map hasil query
interface DataCountMap {
  [key: string]: number;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters untuk filter AOP
    const q = searchParams.get('q') || '';
    const vendorNames = searchParams.getAll('vendor_name') || [];
    const programReports = searchParams.getAll('program_report') || [];
    const circles = searchParams.getAll('region_circle') || [];
    const siteCategories = searchParams.getAll('site_category') || [];
    
    // Generate dates for the last 7 days
    const today = new Date();
    const dates: DateRecord[] = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      return {
        date,
        formatted: format(date, 'dd-MMM-yy'),
        sqlDate: format(date, 'yyyy-MM-dd')
      };
    });
    
    // Calculate date range for optimization (last 7 days)
    const startDate = dates[0].sqlDate;
    const endDate = dates[dates.length - 1].sqlDate;
    
    // Build Supabase query with filters - optimized: only select needed columns
    let query = supabase
      .from('site_data_aop')
      .select('rfs_ff, rfs_af', { count: 'exact' }); // Forecast and Actual
    
    // Apply filters
    if (q) {
      query = query.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`);
    }
    if (vendorNames.length) {
      query = query.in('vendor_name', vendorNames);
    }
    if (programReports.length) {
      query = query.in('program_report', programReports);
    }
    if (circles.length) {
      query = query.in('region_circle', circles);
    }
    if (siteCategories.length) {
      query = query.in('site_category', siteCategories);
    }
    
    // Get data from Supabase with pagination
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query.range(from, to);
      
      if (error) {
        console.error("Supabase Error:", error);
        // Return empty data on error
        const emptyData = dates.map(({ formatted }) => ({
          date: formatted,
          forecast: 0,
          actual: 0
        }));
        
        return NextResponse.json({
          status: 'success',
          data: emptyData,
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
      
      // Safety break untuk mencegah infinite loop
      if (page > 50) {
        console.warn('Stopping pagination after 50 pages');
        break;
      }
    }
    
    // Process data to count by date (optimized: early exit for dates outside range)
    const forecastMap: DataCountMap = {};
    const actualMap: DataCountMap = {};
    const dateSet = new Set(dates.map(d => d.sqlDate)); // Pre-compute valid dates for faster lookup
    
    allData.forEach(row => {
      // Process forecast data (rfs_ff) - only process if date is within range
      if (row.rfs_ff) {
        try {
          const date = new Date(row.rfs_ff);
          const dateKey = format(date, 'yyyy-MM-dd');
          // Only count if date is within our 7-day range
          if (dateSet.has(dateKey)) {
            forecastMap[dateKey] = (forecastMap[dateKey] || 0) + 1;
          }
        } catch (e) {
          // Skip invalid dates
        }
      }
      
      // Process actual data (rfs_af) - only process if date is within range
      if (row.rfs_af) {
        try {
          const date = new Date(row.rfs_af);
          const dateKey = format(date, 'yyyy-MM-dd');
          // Only count if date is within our 7-day range
          if (dateSet.has(dateKey)) {
            actualMap[dateKey] = (actualMap[dateKey] || 0) + 1;
          }
        } catch (e) {
          // Skip invalid dates
        }
      }
    });
    
    // Combine data for each date
    const dailyData = dates.map(({ date, formatted }) => {
      const sqlDateStr = format(date, 'yyyy-MM-dd');
      return {
        date: formatted,
        forecast: forecastMap[sqlDateStr] || 0,
        actual: actualMap[sqlDateStr] || 0
      };
    });

    console.log("AOP Daily Runrate API returned data:", dailyData);
    
    return NextResponse.json({
      status: 'success',
      data: dailyData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching AOP daily runrate data:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch AOP daily runrate data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}


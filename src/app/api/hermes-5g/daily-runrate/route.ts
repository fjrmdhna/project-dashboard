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
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const vendorFilter = searchParams.get('vendorFilter') || 'all';
    const programFilter = searchParams.get('programFilter') || 'all';
    const cityFilter = searchParams.get('cityFilter') || 'all';
    const searchFilter = searchParams.get('searchFilter') || '';
    
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
    
    // Build Supabase query with filters
    let query = supabase.from('site_data_5g').select('imp_integ_af, rfs_af');
    
    // Apply filters
    if (searchFilter) {
      query = query.or(`system_key.ilike.%${searchFilter}%,site_id.ilike.%${searchFilter}%,site_name.ilike.%${searchFilter}%,vendor_name.ilike.%${searchFilter}%`);
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
      console.error("Supabase Error:", error);
      // Return empty data on error
      const emptyData = dates.map(({ formatted }) => ({
        date: formatted,
        readiness: 0,
        activated: 0
      }));
      
      return NextResponse.json({
        status: 'success',
        data: emptyData,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
    
    // Process data to count by date
    const readinessMap: DataCountMap = {};
    const activatedMap: DataCountMap = {};
    
    data?.forEach(row => {
      // Process readiness data
      if (row.imp_integ_af) {
        const date = new Date(row.imp_integ_af);
        const dateKey = format(date, 'yyyy-MM-dd');
        readinessMap[dateKey] = (readinessMap[dateKey] || 0) + 1;
      }
      
      // Process activated data
      if (row.rfs_af) {
        const date = new Date(row.rfs_af);
        const dateKey = format(date, 'yyyy-MM-dd');
        activatedMap[dateKey] = (activatedMap[dateKey] || 0) + 1;
      }
    });
    
    // Combine data for each date
    const dailyData = dates.map(({ date, formatted }) => {
      const sqlDateStr = format(date, 'yyyy-MM-dd');
      return {
        date: formatted,
        readiness: readinessMap[sqlDateStr] || 0,
        activated: activatedMap[sqlDateStr] || 0
      };
    });

    console.log("API returned data:", dailyData);
    
    return NextResponse.json({
      status: 'success',
      data: dailyData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching daily runrate data:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch daily runrate data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { parseFilterParams } from '@/lib/filters';

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
    const { q, vendorNames, programReports, impTtps, nanoClusters } = parseFilterParams(url);
    
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
    // Apply filters (multi-value support)
    if (q) {
      query = query.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`);
    }
    if (vendorNames.length) {
      query = query.in('vendor_name', vendorNames);
    }
    if (programReports.length) {
      query = query.in('program_report', programReports);
    }
    if (impTtps.length) {
      query = query.in('imp_ttp', impTtps);
    }
    if (nanoClusters.length) {
      query = query.in('nano_cluster', nanoClusters);
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

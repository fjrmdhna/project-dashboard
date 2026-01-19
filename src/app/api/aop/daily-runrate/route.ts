import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { 
  getCache, 
  setCache, 
  getFilterHash,
  CACHE_KEYS, 
  CACHE_TTL,
  type FilterParams 
} from '@/lib/redis';

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

// Interface untuk daily data
interface DailyData {
  date: string;
  forecast: number;
  actual: number;
}

// Generate dates for the last 7 days
function generateDates(): DateRecord[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    return {
      date,
      formatted: format(date, 'dd-MMM-yy'),
      sqlDate: format(date, 'yyyy-MM-dd')
    };
  });
}

// Fetch data from database with pagination
async function fetchDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string
): Promise<any[]> {
  let allData: any[] = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;
  const MAX_PAGES = 100;

  // Build Supabase query with filters - optimized: only select needed columns
  let baseQuery = supabase
    .from('site_data_aop')
    .select('rfs_ff, rfs_af', { count: 'exact' });

  // Apply filters
  if (q) {
    baseQuery = baseQuery.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`);
  }
  if (vendorNames.length) {
    baseQuery = baseQuery.in('vendor_name', vendorNames);
  }
  if (programReports.length) {
    baseQuery = baseQuery.in('program_report', programReports);
  }
  if (circles.length) {
    const circleConditions = circles
      .map(c => {
        const normalized = c.trim().toLowerCase();
        return `region_circle.ilike.${normalized}`;
      })
      .join(',');
    baseQuery = baseQuery.or(circleConditions);
  }
  if (siteCategories.length) {
    const siteCategoryConditions = siteCategories
      .map(sc => {
        const normalized = sc.trim().toLowerCase();
        return `site_category.ilike.${normalized}`;
      })
      .join(',');
    baseQuery = baseQuery.or(siteCategoryConditions);
  }

  // Fetch all data using pagination
  while (hasMore && page < MAX_PAGES) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await baseQuery.range(from, to);

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  if (page >= MAX_PAGES) {
    console.warn(`[AOP Daily Runrate] Pagination safety limit reached at ${page} pages, fetched ${allData.length} records`);
  }

  return allData;
}

// Process data to count by date
function processDataToDailyCounts(allData: any[], dates: DateRecord[]): DailyData[] {
  const forecastMap: DataCountMap = {};
  const actualMap: DataCountMap = {};
  const dateSet = new Set(dates.map(d => d.sqlDate));

  allData.forEach(row => {
    // Process forecast data (rfs_ff)
    if (row.rfs_ff) {
      try {
        const date = new Date(row.rfs_ff);
        const dateKey = format(date, 'yyyy-MM-dd');
        if (dateSet.has(dateKey)) {
          forecastMap[dateKey] = (forecastMap[dateKey] || 0) + 1;
        }
      } catch {
        // Skip invalid dates
      }
    }

    // Process actual data (rfs_af)
    if (row.rfs_af) {
      try {
        const date = new Date(row.rfs_af);
        const dateKey = format(date, 'yyyy-MM-dd');
        if (dateSet.has(dateKey)) {
          actualMap[dateKey] = (actualMap[dateKey] || 0) + 1;
        }
      } catch {
        // Skip invalid dates
      }
    }
  });

  // Combine data for each date
  return dates.map(({ date, formatted }) => {
    const sqlDateStr = format(date, 'yyyy-MM-dd');
    return {
      date: formatted,
      forecast: forecastMap[sqlDateStr] || 0,
      actual: actualMap[sqlDateStr] || 0
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Parse query parameters
    const q = searchParams.get('q') || '';
    const vendorNames = searchParams.getAll('vendor_name') || [];
    const programReports = searchParams.getAll('program_report') || [];
    const circles = searchParams.getAll('region_circle') || [];
    const siteCategories = searchParams.getAll('site_category') || [];

    // Create filter params for cache key
    const filterParams: FilterParams = {
      vendorNames,
      programReports,
      circles,
      siteCategories,
      search: q
    };

    // Generate cache key
    const filterHash = getFilterHash(filterParams);
    const cacheKey = CACHE_KEYS.AOP_DAILY_RUNRATE(filterHash);

    // Try to get from Redis cache first
    const cachedData = await getCache<DailyData[]>(cacheKey);

    if (cachedData) {
      console.log(`[AOP Daily Runrate] Returning cached data for filter: ${filterHash}`);
      return NextResponse.json({
        status: 'success',
        data: cachedData,
        timestamp: new Date().toISOString(),
        cached: true
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      });
    }

    // Cache miss - fetch from database
    console.log(`[AOP Daily Runrate] Cache miss, fetching from database...`);
    const startTime = Date.now();

    const dates = generateDates();

    try {
      const allData = await fetchDataFromDatabase(
        vendorNames,
        programReports,
        circles,
        siteCategories,
        q
      );

      const dailyData = processDataToDailyCounts(allData, dates);
      const fetchTime = Date.now() - startTime;

      console.log(`[AOP Daily Runrate] Database fetch completed in ${fetchTime}ms`);

      // Cache the response (don't await to not block response)
      setCache(cacheKey, dailyData, CACHE_TTL.DAILY_RUNRATE).catch(err => {
        console.error('[AOP Daily Runrate] Failed to cache response:', err);
      });

      return NextResponse.json({
        status: 'success',
        data: dailyData,
        timestamp: new Date().toISOString(),
        cached: false,
        fetchTime
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      });
    } catch (dbError) {
      // Return empty data on database error
      const emptyData = dates.map(({ formatted }) => ({
        date: formatted,
        forecast: 0,
        actual: 0
      }));

      return NextResponse.json({
        status: 'success',
        data: emptyData,
        timestamp: new Date().toISOString(),
        error: dbError instanceof Error ? dbError.message : 'Database error'
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      });
    }
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

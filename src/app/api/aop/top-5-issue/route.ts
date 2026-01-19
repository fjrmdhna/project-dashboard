import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  getCache, 
  setCache, 
  getFilterHash,
  CACHE_KEYS, 
  CACHE_TTL,
  type FilterParams 
} from '@/lib/redis';

// Warna untuk kategori issue
const ISSUE_COLORS = [
  '#FF6B6B', // Merah
  '#F7B267', // Orange
  '#4ECDC4', // Teal/Cyan
  '#5DA3FA', // Biru
  '#C792EA', // Ungu
];

// Interface for issue result
interface IssueResult {
  category: string;
  count: number;
  color: string;
}

// Interface for cache data
interface TopIssueResponse {
  data: IssueResult[];
  top5Count: number;
  filteredTotalCount: number;
  totalCount: number;
}

// Fetch data from database with pagination
async function fetchIssueDataFromDatabase(
  vendorNames: string[],
  programReports: string[],
  circles: string[],
  siteCategories: string[],
  q: string
): Promise<{ allData: any[], dbTotalCount: number }> {
  let allData: any[] = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;
  const MAX_PAGES = 100;
  let dbTotalCount = 0;

  // Build Supabase query with filters
  let baseQuery = supabase
    .from('site_data_aop')
    .select('issue_category', { count: 'exact' })
    .not('issue_category', 'is', null)
    .neq('issue_category', '');

  // Filter out excluded categories
  baseQuery = baseQuery
    .not('issue_category', 'ilike', '%no issue%')
    .not('issue_category', 'ilike', '%caf ny submit%')
    .not('issue_category', 'ilike', '%20. 5g activation done%')
    .not('issue_category', 'ilike', '%18c. 5g integration done%');

  // Apply filters
  if (q) {
    baseQuery = baseQuery.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%,issue_category.ilike.%${q}%`);
  }
  if (vendorNames.length > 0) {
    baseQuery = baseQuery.in('vendor_name', vendorNames);
  }
  if (programReports.length > 0) {
    baseQuery = baseQuery.in('program_report', programReports);
  }
  if (circles.length > 0) {
    const circleConditions = circles
      .map(c => {
        const normalized = c.trim().toLowerCase();
        return `region_circle.ilike.${normalized}`;
      })
      .join(',');
    baseQuery = baseQuery.or(circleConditions);
  }
  if (siteCategories.length > 0) {
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

    const { data: pageData, error, count: pageCount } = await baseQuery.range(from, to);

    if (error) {
      console.error('Supabase Error:', error);
      throw error;
    }

    if (pageCount !== null && dbTotalCount === 0) {
      dbTotalCount = pageCount;
    }

    if (pageData && pageData.length > 0) {
      allData = [...allData, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  if (page >= MAX_PAGES) {
    console.warn(`[AOP Top 5 Issue] Pagination safety limit reached at ${page} pages, fetched ${allData.length} records`);
  }

  return { allData, dbTotalCount };
}

// Process data to get top 5 issues
function processTopIssues(allData: any[], dbTotalCount: number): TopIssueResponse {
  // Count issue categories
  const categoryCount: { [key: string]: number } = {};
  allData.forEach(row => {
    if (row.issue_category) {
      categoryCount[row.issue_category] = (categoryCount[row.issue_category] || 0) + 1;
    }
  });

  // Sort by count and get top 5
  const sortedCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Add colors to the data
  const result: IssueResult[] = sortedCategories.map(([category, categoryTotal], index) => ({
    category,
    count: categoryTotal,
    color: ISSUE_COLORS[index % ISSUE_COLORS.length]
  }));

  // Calculate totals
  const totalCount = dbTotalCount || allData.length;
  const top5Count = result.reduce((sum, item) => sum + item.count, 0);
  const filteredTotalCount = Object.values(categoryCount).reduce((sum, val) => sum + val, 0);

  return {
    data: result,
    top5Count,
    filteredTotalCount,
    totalCount
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

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
    const cacheKey = CACHE_KEYS.AOP_TOP_ISSUE(filterHash);

    // Try to get from Redis cache first
    const cachedData = await getCache<TopIssueResponse>(cacheKey);

    if (cachedData) {
      console.log(`[AOP Top 5 Issue] Returning cached data for filter: ${filterHash}`);
      return NextResponse.json({
        status: 'success',
        ...cachedData,
        timestamp: new Date().toISOString(),
        cached: true
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      });
    }

    // Cache miss - fetch from database
    console.log(`[AOP Top 5 Issue] Cache miss, fetching from database...`);
    const startTime = Date.now();

    const { allData, dbTotalCount } = await fetchIssueDataFromDatabase(
      vendorNames,
      programReports,
      circles,
      siteCategories,
      q
    );

    const responseData = processTopIssues(allData, dbTotalCount);
    const fetchTime = Date.now() - startTime;

    console.log(`[AOP Top 5 Issue] Database fetch completed in ${fetchTime}ms, ${allData.length} records`);

    // Cache the response (don't await to not block response)
    setCache(cacheKey, responseData, CACHE_TTL.TOP_ISSUE).catch(err => {
      console.error('[AOP Top 5 Issue] Failed to cache response:', err);
    });

    return NextResponse.json({
      status: 'success',
      ...responseData,
      timestamp: new Date().toISOString(),
      cached: false,
      fetchTime
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

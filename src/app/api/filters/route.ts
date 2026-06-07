import { NextRequest, NextResponse } from 'next/server';
import { getFilterOptions } from '@/lib/hermes-5g-utils';
import { getCache, setCache } from '@/lib/redis';
import {
  getDataScopeCacheKey,
  parseDataScopeFromSearchParams,
} from '@/lib/hermes-dashboard-scope';

type CachedHermesFilterOptions = {
  data: {
    vendors: string[];
    programs: string[];
    cities: string[];
    nanoClusters: string[];
    regions: string[];
    circles: string[];
    years: string[];
    ranScores: string[];
    siteCategories: string[];
  };
  timestamp: string;
};

const FILTER_OPTIONS_CACHE_TTL_SECONDS = 300;

function getFilterOptionsCacheKey(scopeKey: string): string {
  return scopeKey === 'all'
    ? 'hermes:filter-options:v1'
    : `hermes:filter-options:v1:${scopeKey}`;
}

export async function GET(request: NextRequest) {
  try {
    // Check for refresh parameter to force fresh data
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const dataScope = parseDataScopeFromSearchParams(searchParams);
    const scopeKey = getDataScopeCacheKey(dataScope);
    const cacheKey = getFilterOptionsCacheKey(scopeKey);
    
    if (forceRefresh) {
      console.log('[Hermes Filters API] Force refresh requested, fetching fresh data...');
    } else {
      const cached = await getCache<CachedHermesFilterOptions>(cacheKey);
      if (cached?.data) {
        return NextResponse.json({
          status: 'success',
          data: cached.data,
          timestamp: cached.timestamp,
          cached: true,
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
          }
        });
      }
    }
    
    const filterOptions = await getFilterOptions({ forceRefresh, dataScope });
    
    if (filterOptions.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch filter options' },
        { status: 500 }
      );
    }
    
    const responsePayload: CachedHermesFilterOptions = {
      data: {
        vendors: filterOptions.data.vendors,
        programs: filterOptions.data.programs,
        cities: filterOptions.data.cities,
        nanoClusters: filterOptions.data.nanoClusters,
        regions: filterOptions.data.regions, // Deprecated: kept for backward compatibility
        circles: filterOptions.data.circles, // New: circles from region_circle
        years: filterOptions.data.years,
        ranScores: filterOptions.data.ranScores,
        siteCategories: filterOptions.data.siteCategories ?? [],
      },
      timestamp: new Date().toISOString(),
    };

    // Cache success response (non-blocking)
    setCache(cacheKey, responsePayload, FILTER_OPTIONS_CACHE_TTL_SECONDS).catch(() => {});

    return NextResponse.json({
      status: 'success',
      data: responsePayload.data,
      timestamp: responsePayload.timestamp,
      cached: !forceRefresh,
    }, {
      headers: {
        'Cache-Control': forceRefresh 
          ? 'no-cache, no-store, must-revalidate' 
          : 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error in filters API route:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { getFilterOptions } from '@/lib/hermes-5g-utils';

export async function GET(request: NextRequest) {
  try {
    // Check for refresh parameter to force fresh data
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    if (forceRefresh) {
      console.log('[Hermes Filters API] Force refresh requested, fetching fresh data...');
    }
    
    const filterOptions = await getFilterOptions();
    
    if (filterOptions.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch filter options' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        vendors: filterOptions.data.vendors,
        programs: filterOptions.data.programs,
        cities: filterOptions.data.cities,
        nanoClusters: filterOptions.data.nanoClusters,
        regions: filterOptions.data.regions,
        years: filterOptions.data.years,
        ranScores: filterOptions.data.ranScores,
      },
      timestamp: new Date().toISOString(),
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
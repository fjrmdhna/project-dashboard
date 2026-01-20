import { NextRequest, NextResponse } from 'next/server'
import { getAopFilterOptions } from '@/lib/supabase'
import { getCacheOrFetch, deleteCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    // Check for refresh parameter to force cache invalidation
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    // If force refresh, delete Redis cache first
    if (forceRefresh) {
      console.log('[AOP Filters API] Force refresh requested, invalidating Redis cache...')
      await deleteCache(CACHE_KEYS.AOP_FILTERS)
    }

    // Use Redis cache for filter options (high TTL - data jarang berubah)
    const options = await getCacheOrFetch(
      CACHE_KEYS.AOP_FILTERS,
      async () => {
        console.log('[AOP Filters API] Fetching from database...')
        // Pass forceRefresh to also clear in-memory cache
        return await getAopFilterOptions(forceRefresh)
      },
      CACHE_TTL.FILTERS // 10 minutes
    )

    return NextResponse.json({
      status: 'success',
      data: options,
      timestamp: new Date().toISOString(),
      cached: !forceRefresh // Indicate if this was from cache
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching AOP filter options:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch AOP filter options' },
      { status: 500 }
    )
  }
}


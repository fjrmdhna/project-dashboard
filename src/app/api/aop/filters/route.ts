import { NextResponse } from 'next/server'
import { getAopFilterOptions } from '@/lib/supabase'
import { getCacheOrFetch, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

export async function GET() {
  try {
    // Use Redis cache for filter options (high TTL - data jarang berubah)
    const options = await getCacheOrFetch(
      CACHE_KEYS.AOP_FILTERS,
      async () => {
        console.log('[AOP Filters API] Fetching from database...')
        return await getAopFilterOptions()
      },
      CACHE_TTL.FILTERS // 10 minutes
    )

    return NextResponse.json({
      status: 'success',
      data: options,
      timestamp: new Date().toISOString(),
      cached: true // Indicate this might be from cache
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


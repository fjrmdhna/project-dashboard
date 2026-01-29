import { NextRequest, NextResponse } from 'next/server'
import { getFilterOptions } from '@/lib/hermes-5g-utils'
import { getCache, setCache } from '@/lib/redis'

type CachedHermesFilterOptions = {
  data: {
    vendors: string[]
    programs: string[]
    cities: string[]
    nanoClusters: string[]
    regions: string[]
    circles: string[]
    years: string[]
    ranScores: string[]
    siteCategories: string[]
  }
  timestamp: string
}

const FILTER_OPTIONS_CACHE_KEY = 'hermes:filter-options:v1'
const FILTER_OPTIONS_CACHE_TTL_SECONDS = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      const cached = await getCache<CachedHermesFilterOptions>(FILTER_OPTIONS_CACHE_KEY)
      if (cached?.data) {
        return NextResponse.json({
          status: 'success',
          data: cached.data,
          timestamp: cached.timestamp,
          cached: true
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
          }
        })
      }
    }

    const result = await getFilterOptions({ forceRefresh })
    
    if (result.status === 'error') {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Failed to fetch filter options',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
    
    const responsePayload: CachedHermesFilterOptions = {
      data: {
        vendors: result.data.vendors,
        programs: result.data.programs,
        cities: result.data.cities,
        nanoClusters: result.data.nanoClusters,
        regions: result.data.regions, // deprecated
        circles: result.data.circles ?? [],
        years: result.data.years,
        ranScores: result.data.ranScores,
        siteCategories: result.data.siteCategories ?? [],
      },
      timestamp: result.timestamp,
    }

    setCache(FILTER_OPTIONS_CACHE_KEY, responsePayload, FILTER_OPTIONS_CACHE_TTL_SECONDS).catch(() => {})

    return NextResponse.json({
      status: 'success',
      data: responsePayload.data,
      timestamp: responsePayload.timestamp,
      cached: !forceRefresh
    }, {
      headers: {
        'Cache-Control': forceRefresh
          ? 'no-cache, no-store, must-revalidate'
          : 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch filter options',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import { getFilterOptions } from '@/lib/hermes-5g-utils'
import { getCache, setCache } from '@/lib/redis'
import {
  getDataScopeCacheKey,
  parseDataScopeFromSearchParams,
} from '@/lib/hermes-dashboard-scope'

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

const FILTER_OPTIONS_CACHE_TTL_SECONDS = 300

function getFilterOptionsCacheKey(scopeKey: string): string {
  return scopeKey === 'all'
    ? 'hermes:filter-options:v1'
    : `hermes:filter-options:v1:${scopeKey}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'
    const dataScope = parseDataScopeFromSearchParams(searchParams)
    const scopeKey = getDataScopeCacheKey(dataScope)
    const cacheKey = getFilterOptionsCacheKey(scopeKey)

    if (!forceRefresh) {
      const cached = await getCache<CachedHermesFilterOptions>(cacheKey)
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

    const result = await getFilterOptions({ forceRefresh, dataScope })
    
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

    setCache(cacheKey, responsePayload, FILTER_OPTIONS_CACHE_TTL_SECONDS).catch(() => {})

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
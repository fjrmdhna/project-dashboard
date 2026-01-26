import { NextRequest, NextResponse } from 'next/server'
import { deleteCache, CACHE_KEYS, invalidatePattern } from '@/lib/redis'
import { clearAopFilterOptionsCache } from '@/lib/supabase'

/**
 * Clear all AOP-related caches
 * This endpoint clears both Redis cache and in-memory cache
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Clear Cache API] Clearing all AOP caches...')
    
    // Clear Redis cache for filters
    await deleteCache(CACHE_KEYS.AOP_FILTERS)
    console.log('[Clear Cache API] Cleared Redis cache for AOP filters')
    
    // Clear all AOP-related Redis cache patterns
    const patterns = [
      'aop:filters',
      'aop:site-data:*',
      'aop:stats:*',
      'aop:daily-runrate:*',
      'aop:top-5-issue:*',
      'aop:map-data:*'
    ]
    
    for (const pattern of patterns) {
      const deleted = await invalidatePattern(pattern)
      if (deleted > 0) {
        console.log(`[Clear Cache API] Cleared ${deleted} keys matching pattern: ${pattern}`)
      }
    }
    
    // Clear in-memory cache
    clearAopFilterOptionsCache()
    console.log('[Clear Cache API] Cleared in-memory filter options cache')
    
    return NextResponse.json({
      status: 'success',
      message: 'All AOP caches cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Clear Cache API] Error clearing cache:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}

// Also support GET for convenience
export async function GET(request: NextRequest) {
  return POST(request)
}

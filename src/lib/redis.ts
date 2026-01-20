import { Redis } from '@upstash/redis'

// ============================================================================
// Upstash Redis Client & Helper Functions
// ============================================================================
// Best practices:
// 1. Cache-Aside Pattern: Check cache first, fetch if miss, then cache
// 2. Graceful Degradation: Fallback ke database jika Redis down
// 3. TTL-based Invalidation: Automatic expiry untuk data freshness
// 4. Consistent Hashing: Filter hash untuk cache key consistency
// ============================================================================

// Singleton Redis instance
// Supports both Upstash Redis and Vercel KV (which uses Upstash under the hood)
// Priority: UPSTASH_* > KV_REST_API_* (Vercel KV)
let redisInstance: Redis | null = null

/**
 * Get Redis instance (singleton pattern)
 * Returns null if Redis is not configured (graceful degradation)
 * Supports both:
 * - Upstash Redis: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * - Vercel KV: KV_REST_API_URL, KV_REST_API_TOKEN
 */
export function getRedis(): Redis | null {
  if (redisInstance) {
    return redisInstance
  }

  // Check for Upstash Redis env vars first
  let url = process.env.UPSTASH_REDIS_REST_URL
  let token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Fallback to Vercel KV env vars
  if (!url || !token) {
    url = process.env.KV_REST_API_URL
    token = process.env.KV_REST_API_TOKEN
  }

  if (!url || !token) {
    console.warn('[Redis] No Redis credentials found. Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN')
    return null
  }

  try {
    // Create Redis instance with explicit URL and token
    redisInstance = new Redis({
      url,
      token
    })
    console.log('[Redis] Connected to Redis (Upstash/Vercel KV)')
    return redisInstance
  } catch (error) {
    console.error('[Redis] Failed to connect:', error)
    return null
  }
}

// ============================================================================
// Cache Helper Functions
// ============================================================================

/**
 * Get data from cache with auto JSON parse
 * @param key Cache key
 * @returns Parsed data or null if not found/error
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const data = await redis.get<T>(key)
    if (data) {
      console.log(`[Redis] Cache HIT: ${key}`)
    }
    return data
  } catch (error) {
    console.error(`[Redis] Error getting cache for ${key}:`, error)
    return null
  }
}

/**
 * Set data to cache with TTL
 * @param key Cache key
 * @param data Data to cache (will be JSON stringified)
 * @param ttlSeconds Time-to-live in seconds
 */
export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.set(key, data, { ex: ttlSeconds })
    console.log(`[Redis] Cache SET: ${key} (TTL: ${ttlSeconds}s)`)
  } catch (error) {
    console.error(`[Redis] Error setting cache for ${key}:`, error)
  }
}

/**
 * Delete a cache key
 * @param key Cache key to delete
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(key)
    console.log(`[Redis] Cache DEL: ${key}`)
  } catch (error) {
    console.error(`[Redis] Error deleting cache for ${key}:`, error)
  }
}

/**
 * Cache-aside pattern: Get from cache or fetch and cache
 * @param key Cache key
 * @param fetchFn Function to fetch data if cache miss
 * @param ttlSeconds Time-to-live in seconds
 * @returns Data from cache or fetched data
 */
export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try to get from cache first
  const cached = await getCache<T>(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - fetch data
  console.log(`[Redis] Cache MISS: ${key}, fetching from source...`)
  const data = await fetchFn()

  // Cache the fetched data (don't await to not block response)
  setCache(key, data, ttlSeconds).catch(err => {
    console.error(`[Redis] Background cache set failed for ${key}:`, err)
  })

  return data
}

/**
 * Invalidate cache keys matching a pattern
 * Note: Upstash Redis supports SCAN for pattern matching
 * @param pattern Pattern to match (e.g., "aop:*")
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    let cursor: number = 0
    let deletedCount = 0
    const keysToDelete: string[] = []

    // SCAN for keys matching pattern
    do {
      const result = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = Number(result[0])
      const keys = result[1] as string[]
      keysToDelete.push(...keys)
    } while (cursor !== 0)

    // Delete all matching keys
    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map(key => redis.del(key)))
      deletedCount = keysToDelete.length
      console.log(`[Redis] Invalidated ${deletedCount} keys matching pattern: ${pattern}`)
    }

    return deletedCount
  } catch (error) {
    console.error(`[Redis] Error invalidating pattern ${pattern}:`, error)
    return 0
  }
}

// ============================================================================
// Cache Key Generators
// ============================================================================

/**
 * Interface for filter parameters
 */
export interface FilterParams {
  vendorNames?: string[]
  programReports?: string[]
  circles?: string[]
  siteCategories?: string[]
  ranScores?: string[]
  years?: string[]
  search?: string
}

/**
 * Generate a consistent hash for filter parameters
 * Used as part of cache key to uniquely identify filter combinations
 * @param filters Filter parameters
 * @returns Base64-encoded hash string
 */
export function getFilterHash(filters: FilterParams): string {
  const normalized = {
    v: filters.vendorNames?.slice().sort() || [],
    p: filters.programReports?.slice().sort() || [],
    c: filters.circles?.slice().sort() || [],
    s: filters.siteCategories?.slice().sort() || [],
    r: filters.ranScores?.slice().sort() || [],
    y: filters.years?.slice().sort() || [],
    q: (filters.search || '').toLowerCase().trim()
  }

  // Use simple base64 encoding (works in Node.js)
  const jsonString = JSON.stringify(normalized)
  const base64 = Buffer.from(jsonString).toString('base64')
  
  // Use full base64 string to ensure all filter values are included in hash
  // Previous truncation to 32 chars caused siteCategories to be excluded
  // when other filters were empty (JSON started with {"v":[],"p":[],"c":[],"s...)
  return base64
}

/**
 * Check if filters are empty (no filter applied)
 * @param filters Filter parameters
 * @returns true if no filters are applied
 */
export function isEmptyFilter(filters: FilterParams): boolean {
  return (
    (!filters.vendorNames || filters.vendorNames.length === 0) &&
    (!filters.programReports || filters.programReports.length === 0) &&
    (!filters.circles || filters.circles.length === 0) &&
    (!filters.siteCategories || filters.siteCategories.length === 0) &&
    (!filters.ranScores || filters.ranScores.length === 0) &&
    (!filters.years || filters.years.length === 0) &&
    (!filters.search || filters.search.trim() === '')
  )
}

// ============================================================================
// Cache Key Constants
// ============================================================================

export const CACHE_KEYS = {
  // Filter options cache (high TTL - data jarang berubah)
  AOP_FILTERS: 'aop:filters',
  
  // Site data cache patterns
  AOP_SITE_DATA: (hash: string) => `aop:site-data:${hash}`,
  AOP_SITE_DATA_NOFILTER: 'aop:site-data:nofilter',
  
  // Stats cache patterns
  AOP_STATS: (hash: string) => `aop:stats:${hash}`,
  
  // Daily runrate cache patterns
  AOP_DAILY_RUNRATE: (hash: string) => `aop:daily-runrate:${hash}`,
  
  // Top 5 issue cache patterns
  AOP_TOP_ISSUE: (hash: string) => `aop:top-5-issue:${hash}`,
  
  // Map data cache patterns
  AOP_MAP_DATA: (hash: string) => `aop:map-data:${hash}`,
}

// TTL Constants (in seconds)
export const CACHE_TTL = {
  // Filter options - jarang berubah, cache lama
  FILTERS: 10 * 60, // 10 minutes
  
  // Full data tanpa filter - base data
  FULL_DATA: 10 * 60, // 10 minutes
  
  // Stats per filter
  STATS: 5 * 60, // 5 minutes
  
  // Filtered data - shorter TTL karena banyak kombinasi
  FILTERED_DATA: 3 * 60, // 3 minutes
  
  // Daily runrate
  DAILY_RUNRATE: 5 * 60, // 5 minutes
  
  // Top 5 issue
  TOP_ISSUE: 5 * 60, // 5 minutes
  
  // Map data
  MAP_DATA: 5 * 60, // 5 minutes
}

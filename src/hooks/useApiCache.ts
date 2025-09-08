import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
}

interface UseApiCacheOptions {
  staleTime?: number // Time in ms before data is considered stale (default: 5 minutes)
  cacheTime?: number // Time in ms before data is removed from cache (default: 10 minutes)
  refetchOnMount?: boolean // Refetch when component mounts if data is stale
  refetchInterval?: number // Auto refetch interval in ms
}

interface UseApiCacheReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  isStale: boolean
  lastFetched: number | null
}

// Global memory cache
const memoryCache = new Map<string, CacheEntry<any>>()

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.timestamp + entry.expiry) {
      memoryCache.delete(key)
    }
  }
}, 60000) // Cleanup every minute

export function useApiCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: UseApiCacheOptions = {}
): UseApiCacheReturn<T> {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnMount = true,
    refetchInterval
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if data is stale
  const isStale = useCallback(() => {
    const cached = memoryCache.get(cacheKey)
    if (!cached) return true
    
    const now = Date.now()
    return now > cached.timestamp + staleTime
  }, [cacheKey, staleTime])

  // Get cached data
  const getCachedData = useCallback(() => {
    const cached = memoryCache.get(cacheKey)
    if (!cached) return null
    
    const now = Date.now()
    // Check if data has expired
    if (now > cached.timestamp + cached.expiry) {
      memoryCache.delete(cacheKey)
      return null
    }
    
    return cached.data
  }, [cacheKey])

  // Set data in cache
  const setCachedData = useCallback((newData: T) => {
    const now = Date.now()
    memoryCache.set(cacheKey, {
      data: newData,
      timestamp: now,
      expiry: cacheTime
    })
  }, [cacheKey, cacheTime])

  // Fetch data function
  const fetchData = useCallback(async (force = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Check cache first (unless forced)
    if (!force) {
      const cached = getCachedData()
      if (cached && !isStale()) {
        setData(cached)
        setLastFetched(memoryCache.get(cacheKey)?.timestamp || null)
        return
      }
    }

    setLoading(true)
    setError(null)
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()

    try {
      const result = await fetchFn()
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }
      
      setData(result)
      setCachedData(result)
      setLastFetched(Date.now())
      setError(null)
    } catch (err) {
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error(`API Cache Error for ${cacheKey}:`, err)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, fetchFn, getCachedData, isStale, setCachedData])

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  // Initialize data on mount
  useEffect(() => {
    const cached = getCachedData()
    if (cached) {
      setData(cached)
      setLastFetched(memoryCache.get(cacheKey)?.timestamp || null)
      
      // Refetch if stale and refetchOnMount is true
      if (refetchOnMount && isStale()) {
        fetchData()
      }
    } else {
      // No cached data, fetch immediately
      fetchData()
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [cacheKey]) // Only depend on cacheKey to avoid infinite loops

  // Setup refetch interval
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!loading) {
          fetchData()
        }
      }, refetchInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [refetchInterval, loading, fetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch,
    isStale: isStale(),
    lastFetched
  }
}

// Utility function to clear specific cache entry
export function clearCache(cacheKey: string) {
  memoryCache.delete(cacheKey)
}

// Utility function to clear all cache
export function clearAllCache() {
  memoryCache.clear()
}

// Utility function to get cache info
export function getCacheInfo() {
  const entries = Array.from(memoryCache.entries()).map(([key, entry]) => ({
    key,
    size: JSON.stringify(entry.data).length,
    age: Date.now() - entry.timestamp,
    stale: Date.now() > entry.timestamp + 5 * 60 * 1000, // Assuming 5min stale time
    expires: entry.timestamp + entry.expiry
  }))

  return {
    totalEntries: memoryCache.size,
    totalSize: entries.reduce((acc, entry) => acc + entry.size, 0),
    entries
  }
} 
import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
  isEmpty?: boolean // Flag untuk empty data (cache dengan waktu lebih pendek)
}

interface UseApiCacheOptions {
  staleTime?: number // Time in ms before data is considered stale (default: 5 minutes)
  cacheTime?: number // Time in ms before data is removed from cache (default: 10 minutes)
  refetchOnMount?: boolean // Refetch when component mounts if data is stale
  refetchInterval?: number // Auto refetch interval in ms
  validateFn?: <T>(data: T) => boolean // Custom validation function - return false to prevent caching
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

// Global in-flight dedup (prevents double-fetch across hook instances / StrictMode)
const inFlightPromises = new Map<string, Promise<any>>()

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
    refetchInterval,
    validateFn
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true) // Start with true, will be set to false if cached data exists
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetchingRef = useRef<Set<string>>(new Set()) // Track ongoing fetches per cacheKey
  const lastCacheKeyRef = useRef<string>(cacheKey) // Track last cacheKey to detect changes
  const lastFetchTimeRef = useRef<Map<string, number>>(new Map()) // Track last fetch time per cacheKey

  // Check if data is stale
  const isStale = useCallback(() => {
    const cached = memoryCache.get(cacheKey)
    if (!cached) return true
    
    const now = Date.now()
    // Data is stale if it's past staleTime, but not if it's already expired (should be removed)
    // Also, don't consider data stale if it was just fetched (within last 500ms)
    const timeSinceFetch = now - cached.timestamp
    if (timeSinceFetch < 500) {
      return false // Too soon to be stale
    }
    return timeSinceFetch > staleTime
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

  // Validation function to check if data should be cached
  const shouldCache = useCallback((data: T, error: string | null, validateFn?: (data: T) => boolean): { shouldCache: boolean; isEmpty: boolean } => {
    // Don't cache if there's an error
    if (error) {
      return { shouldCache: false, isEmpty: false }
    }

    // Don't cache null or undefined
    if (data === null || data === undefined) {
      return { shouldCache: false, isEmpty: false }
    }

    // Check if data is empty
    const isEmpty = 
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)

    // Use custom validation function if provided
    if (validateFn) {
      const isValid = validateFn(data)
      // Jika validateFn return false, jangan cache (termasuk data kosong)
      // Ini untuk kasus dimana user ingin menolak data tertentu (misalnya data gagal atau bernilai 0)
      if (!isValid) {
        return { shouldCache: false, isEmpty: false }
      }
      // Jika valid, cache dengan expiry sesuai apakah empty atau tidak
      return { shouldCache: true, isEmpty }
    }

    // Cache empty data to prevent infinite refetch, but with shorter expiry
    if (isEmpty) {
      return { shouldCache: true, isEmpty: true }
    }

    return { shouldCache: true, isEmpty: false }
  }, [])

  // Set data in cache with validation
  const setCachedData = useCallback((newData: T, error: string | null = null) => {
    const { shouldCache: canCache, isEmpty } = shouldCache(newData, error, validateFn)
    
    if (!canCache) {
      console.warn(`[useApiCache] Skipping cache for ${cacheKey}: data is invalid or failed validation`)
      return
    }

    const now = Date.now()
    // Cache empty data with shorter expiry (1 minute) to prevent infinite refetch
    // but still cache it to avoid refetching immediately
    const expiryTime = isEmpty ? 1 * 60 * 1000 : cacheTime
    
    memoryCache.set(cacheKey, {
      data: newData,
      timestamp: now,
      expiry: expiryTime,
      isEmpty
    })
  }, [cacheKey, cacheTime, validateFn, shouldCache])

  // Fetch data function
  const fetchData = useCallback(async (force = false, background = false) => {
    // Prevent multiple concurrent fetches for the same cacheKey
    if (fetchingRef.current.has(cacheKey) && !force) {
      console.log(`[useApiCache] Fetch already in progress for ${cacheKey}, skipping...`)
      return
    }

    // Prevent rapid successive fetches (debounce: minimum 500ms between fetches for same cacheKey)
    if (!force) {
      const lastFetchTime = lastFetchTimeRef.current.get(cacheKey)
      const now = Date.now()
      if (lastFetchTime && (now - lastFetchTime) < 500) {
        console.log(`[useApiCache] Too soon to refetch ${cacheKey}, skipping...`)
        return
      }
    }

    // Check cache first (unless forced)
    if (!force) {
      const cached = getCachedData()
      if (cached && !isStale()) {
        setData(cached)
        setLastFetched(memoryCache.get(cacheKey)?.timestamp || null)
        setLoading(false) // Ensure loading is false when using cache
        return
      }
    }

    // Global in-flight dedup: if another instance is already fetching this key, await it.
    // This prevents StrictMode double-mount / multiple consumers from issuing duplicate requests.
    if (!force) {
      const existing = inFlightPromises.get(cacheKey)
      if (existing) {
        fetchingRef.current.add(cacheKey)
        if (!background) setLoading(true)
        setError(null)
        try {
          const result = await existing
          // If cacheKey changed mid-flight, ignore
          if (lastCacheKeyRef.current !== cacheKey) return
          setData(result)
          setCachedData(result, null)
          setLastFetched(Date.now())
          setError(null)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An error occurred'
          setError(errorMessage)
          console.error(`API Cache Error (joined) for ${cacheKey}:`, err)
        } finally {
          fetchingRef.current.delete(cacheKey)
          if (!background) setLoading(false)
        }
        return
      }
    }

    // Cancel previous request for this hook instance
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Mark as fetching and record fetch time
    fetchingRef.current.add(cacheKey)
    lastFetchTimeRef.current.set(cacheKey, Date.now())
    // Hanya set loading true jika bukan background fetch (untuk UX yang lebih baik)
    if (!background) {
      setLoading(true)
    }
    setError(null)
    
    // Create new abort controller
    const controller = new AbortController()
    abortControllerRef.current = controller

    let fetchSucceeded = false
    
    try {
      // Add timeout to prevent infinite loading (60 seconds max)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000)
      })
      
      const fetchPromise = Promise.race([fetchFn(), timeoutPromise])
      // Register in-flight promise globally (only if not forced)
      if (!force) {
        inFlightPromises.set(cacheKey, fetchPromise)
      }

      const result = await fetchPromise
      
      // Check if request was aborted or cacheKey changed
      if (controller.signal.aborted || lastCacheKeyRef.current !== cacheKey) {
        fetchingRef.current.delete(cacheKey)
        return
      }
      
      // Set data to state (even if empty - this prevents infinite refetch)
      // Always set data, even if empty, to stop loading state
      setData(result)
      setCachedData(result, null)
      setLastFetched(Date.now())
      setError(null)
      fetchSucceeded = true
      // Hanya set loading false jika bukan background fetch
      if (!background) {
        setLoading(false) // Ensure loading is false after setting data
      }
    } catch (err) {
      // Check if request was aborted or cacheKey changed
      if (controller.signal.aborted || lastCacheKeyRef.current !== cacheKey) {
        fetchingRef.current.delete(cacheKey)
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      // Don't set data to null on error - keep previous data if available
      console.error(`API Cache Error for ${cacheKey}:`, err)
    } finally {
      // Clear global in-flight promise if it matches our promise
      if (!force) {
        const current = inFlightPromises.get(cacheKey)
        // Only delete if it's the same promise reference we set
        // (prevents races if a new fetch started later)
        if (current) {
          // best-effort: delete regardless; inFlight map is only used as a dedup hint
          inFlightPromises.delete(cacheKey)
        }
      }

      // Always clean up fetchingRef
      fetchingRef.current.delete(cacheKey)
      
      // Only update loading if this is still the current request
      if (abortControllerRef.current === controller && lastCacheKeyRef.current === cacheKey) {
        // Always set loading to false in finally block to prevent stuck loading state
        // This handles error cases and ensures loading never gets stuck
        if (!background) {
          setLoading(false)
        }
      }
    }
  }, [cacheKey, fetchFn, getCachedData, isStale, setCachedData])

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  // Initialize data on mount and when cacheKey changes
  useEffect(() => {
    let isMounted = true
    const currentCacheKey = cacheKey
    
    // Update lastCacheKeyRef
    const cacheKeyChanged = lastCacheKeyRef.current !== currentCacheKey
    if (cacheKeyChanged) {
      lastCacheKeyRef.current = currentCacheKey
    }
    
    // Skip if already fetching for this cacheKey
    if (fetchingRef.current.has(currentCacheKey)) {
      return
    }
    
    const initialize = async () => {
      // Double check mounted and not already fetching
      if (!isMounted || fetchingRef.current.has(currentCacheKey)) {
        return
      }
      
      const cached = getCachedData()
      if (cached && isMounted) {
        // Set cached data immediately - tampilkan data cached dulu untuk UX yang lebih baik
        setData(cached)
        setLastFetched(memoryCache.get(currentCacheKey)?.timestamp || null)
        setLoading(false) // Pastikan loading false saat menggunakan cache
        
        // Refetch di background jika stale dan refetchOnMount is true
        // Jangan set loading true saat refetch background untuk UX yang lebih baik
        if (refetchOnMount && isStale() && lastCacheKeyRef.current === currentCacheKey) {
          const lastFetchTime = lastFetchTimeRef.current.get(currentCacheKey)
          const now = Date.now()
          // Hanya refetch jika cukup waktu telah berlalu (prevent rapid refetch)
          if (!lastFetchTime || (now - lastFetchTime) >= 500) {
            // Refetch di background tanpa set loading true (background = true)
            fetchData(false, true).catch(err => {
              // Error handling - jika refetch gagal, tetap gunakan cached data
              console.warn(`[useApiCache] Background refetch failed for ${currentCacheKey}:`, err)
            })
          }
        }
      } else if (isMounted && !fetchingRef.current.has(currentCacheKey) && lastCacheKeyRef.current === currentCacheKey) {
        // No cached data, fetch immediately (loading sudah true dari initial state)
        const lastFetchTime = lastFetchTimeRef.current.get(currentCacheKey)
        const now = Date.now()
        if (!lastFetchTime || (now - lastFetchTime) >= 500) {
          await fetchData()
        } else {
          // Jika terlalu cepat, set loading false
          setLoading(false)
        }
      } else {
        // No cached data and already fetching or cacheKey changed, set loading false
        setLoading(false)
      }
    }
    
    initialize()

    // Cleanup on unmount or cacheKey change
    return () => {
      isMounted = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Don't remove from fetchingRef here - let fetchData handle it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]) // Only depend on cacheKey - other functions are stable via useCallback

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
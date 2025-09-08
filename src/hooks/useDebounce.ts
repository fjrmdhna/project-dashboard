import { useState, useEffect, useRef, useCallback } from 'react'

// Generic debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  callbackRef.current = callback

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set up new timeout
    timeoutRef.current = window.setTimeout(() => {
      callbackRef.current(...args)
      timeoutRef.current = null
    }, delay)
  }, [delay]) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

// Optimized search debounce hook
export function useSearchDebounce(
  searchTerm: string,
  onSearch: (term: string) => void,
  delay: number = 300
) {
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<number | null>(null)
  const lastSearchRef = useRef<string>('')

  const debouncedSearch = useCallback((term: string) => {
    // Don't search if term hasn't changed
    if (term === lastSearchRef.current) {
      return
    }

    setIsSearching(true)
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set up new timeout
    searchTimeoutRef.current = window.setTimeout(() => {
      lastSearchRef.current = term
      onSearch(term)
      setIsSearching(false)
      searchTimeoutRef.current = null
    }, delay)
  }, [onSearch, delay])

  // Trigger search when searchTerm changes
  useEffect(() => {
    debouncedSearch(searchTerm)
  }, [searchTerm, debouncedSearch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Cancel function
  const cancelSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
      setIsSearching(false)
    }
  }, [])

  return {
    isSearching,
    cancelSearch
  }
}

// Throttle hook (executes at regular intervals)
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastExecuted = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    const timeElapsed = now - lastExecuted.current

    if (timeElapsed >= interval) {
      setThrottledValue(value)
      lastExecuted.current = now
    } else {
      const timeout = setTimeout(() => {
        setThrottledValue(value)
        lastExecuted.current = Date.now()
      }, interval - timeElapsed)

      return () => clearTimeout(timeout)
    }
  }, [value, interval])

  return throttledValue
} 
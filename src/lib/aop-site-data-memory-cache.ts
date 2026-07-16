/** Process-local cache for full unfiltered AOP payloads (too large for Redis). */
export interface AopSiteDataMemoryPayload {
  data: unknown[]
  count: number
  totalCount: number
  stats: Record<string, number>
}

interface MemoryCacheEntry {
  payload: AopSiteDataMemoryPayload
  timestamp: number
}

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, MemoryCacheEntry>()

export function getAopSiteDataMemoryCache(key: string): AopSiteDataMemoryPayload | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.payload
}

export function setAopSiteDataMemoryCache(key: string, payload: AopSiteDataMemoryPayload): void {
  cache.set(key, { payload, timestamp: Date.now() })
}

export function buildAopSiteDataMemoryCacheKey(mode: string, filterHash: string): string {
  return `aop-site-data:${mode}:${filterHash}`
}

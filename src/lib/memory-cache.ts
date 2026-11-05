/**
 * Process-local TTL cache for large payloads that do not fit in Redis/KV.
 * Useful on Cloud Run warm instances (min-instances > 0 keeps it effective).
 */

type Entry<T> = {
  value: T
  expiresAt: number
}

const store = new Map<string, Entry<unknown>>()

export function memoryGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value as T
}

export function memorySet<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  })
}

export function memoryDelete(key: string): void {
  store.delete(key)
}

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_FETCH_PAGE_SIZE = 10_000
/** Keep delete .in() URL short — nginx rejects oversized request URIs (414). */
const DEFAULT_DELETE_CHUNK_SIZE = 50

/**
 * Normalize system_key from Excel/JSON to a non-empty trimmed string.
 */
export function normalizeSystemKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length > 0 ? t : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

export function systemKeySetFromRows(
  rows: Array<{ system_key?: unknown } | Record<string, unknown>>
): Set<string> {
  const set = new Set<string>()
  for (const row of rows) {
    const k = normalizeSystemKey((row as { system_key?: unknown }).system_key)
    if (k) set.add(k)
  }
  return set
}

export type StaleRowSyncResult = {
  deletedCount: number
  error: PostgrestError | null
}

/**
 * Full snapshot sync: delete rows whose system_key exists in the table but not in currentKeys.
 * Skips deletion when currentKeys is empty (avoids wiping the table on bad/partial uploads).
 */
export async function deleteStaleRowsBySystemKey(
  supabase: SupabaseClient,
  table: string,
  currentKeys: Set<string>,
  options?: { fetchPageSize?: number; deleteChunkSize?: number }
): Promise<StaleRowSyncResult> {
  const fetchPageSize = options?.fetchPageSize ?? DEFAULT_FETCH_PAGE_SIZE
  const deleteChunkSize = options?.deleteChunkSize ?? DEFAULT_DELETE_CHUNK_SIZE

  if (currentKeys.size === 0) {
    return { deletedCount: 0, error: null }
  }

  let fromIndex = 0
  const keysToDelete: string[] = []

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('system_key')
      .not('system_key', 'is', null)
      .order('system_key', { ascending: true })
      .range(fromIndex, fromIndex + fetchPageSize - 1)

    if (error) {
      return { deletedCount: 0, error }
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      const key = row.system_key as string | null
      if (key && !currentKeys.has(key)) {
        keysToDelete.push(key)
      }
    }

    if (data.length < fetchPageSize) {
      break
    }

    fromIndex += fetchPageSize
  }

  if (keysToDelete.length === 0) {
    return { deletedCount: 0, error: null }
  }

  const uniqueKeys = Array.from(new Set(keysToDelete))
  let deletedCount = 0

  for (let i = 0; i < uniqueKeys.length; i += deleteChunkSize) {
    const chunk = uniqueKeys.slice(i, i + deleteChunkSize)
    const { error: deleteError } = await supabase.from(table).delete().in('system_key', chunk)

    if (deleteError) {
      return { deletedCount, error: deleteError }
    }
    deletedCount += chunk.length
  }

  return { deletedCount, error: null }
}

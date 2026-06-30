import { applyTlpDbFilters, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import {
  rowMatchesTlpFilters,
  type TlpFilterableRow,
  type TlpSiteFilters,
} from "@/lib/tlp-new-site-filters"

const PAGE_SIZE = 1000

export const TLP_EXPORT_ROW_LIMIT = 50_000

export async function fetchAllTlpRows(
  filters: TlpSiteFilters
): Promise<Record<string, unknown>[]> {
  const supabase = getTlpSupabaseClient()
  const rows: Record<string, unknown>[] = []
  let offset = 0
  let hasMore = true

  while (hasMore && rows.length < TLP_EXPORT_ROW_LIMIT) {
    const { data, error } = await applyTlpDbFilters(
      supabase.from("site_data_tlp").select("*"),
      filters
    ).range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(error.message)
    }

    for (const row of data ?? []) {
      if (!rowMatchesTlpFilters(row as TlpFilterableRow, filters)) continue
      rows.push(row as Record<string, unknown>)
      if (rows.length >= TLP_EXPORT_ROW_LIMIT) break
    }

    hasMore = Boolean(data && data.length === PAGE_SIZE)
    offset += PAGE_SIZE
  }

  return rows
}

/** Primary key column — always first in Excel exports. */
export const TLP_EXPORT_PINNED_LEFT_COLUMNS = ["system_key"] as const

/** Build export column order: pinned left columns first, then remaining keys A→Z. */
export function buildTlpExportHeaders(rows: Record<string, unknown>[]): string[] {
  const keySet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keySet.add(key)
    }
  }

  const pinnedSet = new Set<string>(TLP_EXPORT_PINNED_LEFT_COLUMNS)
  const pinned = TLP_EXPORT_PINNED_LEFT_COLUMNS.filter((column) => keySet.has(column))
  const rest = [...keySet]
    .filter((column) => !pinnedSet.has(column))
    .sort((a, b) => a.localeCompare(b))

  return [...pinned, ...rest]
}

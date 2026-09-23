/**
 * NR 2600 RAN Scope filter.
 * Source column in Supabase: ran_scope.
 * Match is exact on the trimmed value (for example "NR 2.6 (PO Released)").
 */

export type HermesRanFilterMode = "score" | "scope"

export function parseHermesRanFilterMode(
  value: string | null | undefined
): HermesRanFilterMode {
  return value === "scope" ? "scope" : "score"
}

export function hermesFilterOptionsCacheKey(
  scopeKey: string,
  ranFilterMode: HermesRanFilterMode
): string {
  return `hermes:filter-options:v2:${scopeKey}:${ranFilterMode}`
}

export function normalizeRanScopeValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

export function collectDistinctRanScopes(
  rows: Array<{ ran_scope?: string | null }> | null | undefined
): string[] {
  const values = new Set<string>()
  for (const row of rows ?? []) {
    const trimmed = normalizeRanScopeValue(row.ran_scope)
    if (trimmed) values.add(trimmed)
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export function matchesRanScopeFilter(
  rowValue: string | null | undefined,
  selected: ReadonlySet<string>
): boolean {
  const normalized = normalizeRanScopeValue(rowValue)
  return normalized !== "" && selected.has(normalized)
}

export function applyRanScopeFilter<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  ranScopes: string[] | undefined
): T {
  const values = (ranScopes ?? []).map((value) => value.trim()).filter(Boolean)
  if (values.length === 0) return query
  return query.in("ran_scope", values)
}

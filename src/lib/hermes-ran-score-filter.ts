/**
 * Hermes RAN Score filter: single source of truth.
 * Source column in Supabase: program_report.
 * Normalization: "new site" (case-insensitive) → "New Site"; all other values → "Expansion".
 */

/**
 * Normalize value for Hermes RAN Score filter (source: program_report in Supabase).
 * - Contains "new site" (case-insensitive) → "New Site"
 * - All other values (including null/empty) → "Expansion"
 */
export function normalizeRanScoreForHermesFilter(
  value: string | null | undefined
): 'New Site' | 'Expansion' {
  if (!value || typeof value !== 'string') return 'Expansion'
  const lower = value.toLowerCase().trim()
  if (lower.includes('new site')) return 'New Site'
  return 'Expansion'
}

/**
 * Apply RAN Score filter to a Supabase query using program_report column.
 * Filter values are "New Site" | "Expansion"; applied as:
 * - New Site only → program_report ilike '%new%site%'
 * - Expansion only → program_report is null or not ilike '%new%site%'
 * - Both or none → no filter applied.
 */
export function applyRanScoreFilterByProgramReport<T>(
  query: T,
  ranScores: string[] | undefined
): T {
  if (!ranScores?.length) return query
  const q = query as { ilike: (col: string, pattern: string) => T; or: (condition: string) => T }
  const hasNewSite = ranScores.some((rs) => String(rs).trim() === 'New Site')
  const hasExpansion = ranScores.some((rs) => String(rs).trim() === 'Expansion')
  if (hasNewSite && !hasExpansion) return q.ilike('program_report', '%new%site%')
  if (hasExpansion && !hasNewSite) return q.or('program_report.is.null,program_report.not.ilike.%new%site%')
  return query
}

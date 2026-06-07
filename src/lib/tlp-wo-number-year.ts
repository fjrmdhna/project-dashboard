/**
 * Derives calendar year from TLP wo_number_1 (e.g. "146/AJ0-AJF0/PRC/25" → 2025).
 * Uses the last path segment after '/'.
 */
export function parseYearFromWoNumber1(woNumber: unknown): number | null {
  if (woNumber === null || woNumber === undefined) return null

  const value = String(woNumber).trim()
  if (!value) return null

  const slashIndex = value.lastIndexOf("/")
  if (slashIndex === -1 || slashIndex === value.length - 1) return null

  const suffix = value.slice(slashIndex + 1).trim()
  if (!suffix) return null

  if (/^\d{2}$/.test(suffix)) {
    return 2000 + Number.parseInt(suffix, 10)
  }

  if (/^\d{4}$/.test(suffix)) {
    const year = Number.parseInt(suffix, 10)
    if (year >= 1900 && year <= 2100) return year
  }

  return null
}

export function formatWoDerivedYearOption(year: number): string {
  return String(year)
}

/** Collect distinct years (descending) from wo_number_1 values. */
export function collectDistinctWoYears(
  woNumbers: Iterable<unknown>
): string[] {
  const years = new Set<number>()
  for (const wo of woNumbers) {
    const parsed = parseYearFromWoNumber1(wo)
    if (parsed !== null) years.add(parsed)
  }
  return Array.from(years)
    .sort((a, b) => b - a)
    .map(formatWoDerivedYearOption)
}

export function getRowWoDerivedYear(row: {
  year_from_wo?: number | null
  wo_number_1?: string | null
}): number | null {
  if (typeof row.year_from_wo === "number" && !Number.isNaN(row.year_from_wo)) {
    return row.year_from_wo
  }
  return parseYearFromWoNumber1(row.wo_number_1)
}

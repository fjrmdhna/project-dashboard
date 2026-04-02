export interface AccProgressPoint {
  monthKey: string
  label: string
  planCcoAcc: number
  planRfiAcc: number
  actualRfiAcc: number | null
  actualCrfiAcc: number | null
}

/** Program names that define the Plan CCO ACC series (site_data_tlp.program_name). */
export const PLAN_CCO_PROGRAM_NAMES = [
  "Q1 2026 – 467 New Site Coverage",
  "New Site Coverage Q1 Batch 2 2026 25 Sites",
] as const

function normalizeProgramName(value: string): string {
  return value
    .trim()
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
}

export function isPlanCcoProgram(programName: string | null | undefined): boolean {
  if (!programName) return false
  const n = normalizeProgramName(programName)
  if (PLAN_CCO_PROGRAM_NAMES.some((p) => normalizeProgramName(p) === n)) {
    return true
  }
  const lower = n.toLowerCase()
  if (lower.includes("467 new site coverage") && lower.includes("q1 2026")) {
    return true
  }
  if (lower.includes("batch 2") && lower.includes("2026") && lower.includes("25 sites")) {
    return true
  }
  return false
}

export function parseTlpDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined
  const s = String(value).trim()
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  const y = d.getFullYear()
  if (y < 2000 || y > 2100) return undefined
  return d
}

export function endOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999)
}

export function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`
}

export function formatMonthLabel(year: number, monthIndex0: number): string {
  const d = new Date(year, monthIndex0, 1)
  const m = d.toLocaleString("en-US", { month: "short" })
  const yy = String(year).slice(-2)
  return `${m}-${yy}`
}

/**
 * Drops month buckets where cumulative series are still negligible vs the chart peak.
 * Strict `> 0` is not enough: small cumulative counts are non-zero but render as a flat line
 * along the X-axis when the Y domain is driven by later peaks. We keep months where
 * max(series) ≥ max(1, ceil(2% of peak cumulative)).
 */
export function trimAccProgressPointsWithNoActivity(points: AccProgressPoint[]): AccProgressPoint[] {
  if (points.length === 0) return []
  const globalMax = Math.max(
    ...points.flatMap((p) => [
      p.planCcoAcc,
      p.planRfiAcc,
      p.actualRfiAcc ?? 0,
      p.actualCrfiAcc ?? 0,
    ])
  )
  if (globalMax <= 0) return []
  const threshold = Math.max(1, Math.ceil(globalMax * 0.02))
  return points.filter((p) => {
    const m = Math.max(
      p.planCcoAcc,
      p.planRfiAcc,
      p.actualRfiAcc ?? 0,
      p.actualCrfiAcc ?? 0
    )
    return m >= threshold
  })
}

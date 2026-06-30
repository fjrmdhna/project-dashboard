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

export type TlpAccProgressInputRow = {
  program_name?: string | null
  ic_000010_ff?: string | null
  ic_000010_af?: string | null
  rfi_accepted?: string | null
}

export function buildAccProgressCurveFromRows(rows: TlpAccProgressInputRow[]): AccProgressPoint[] {
  let minY = 2099
  let minM = 11
  let maxY = 2000
  let maxM = 0
  let lastAf: Date | undefined
  let lastCr: Date | undefined

  const consider = (d: Date | undefined) => {
    if (!d) return
    const y = d.getFullYear()
    const m = d.getMonth()
    if (y < minY || (y === minY && m < minM)) {
      minY = y
      minM = m
    }
    if (y > maxY || (y === maxY && m > maxM)) {
      maxY = y
      maxM = m
    }
  }

  for (const r of rows) {
    const ff = parseTlpDate(r.ic_000010_ff)
    const af = parseTlpDate(r.ic_000010_af)
    const cr = parseTlpDate(r.rfi_accepted)

    consider(ff)
    consider(af)
    consider(cr)

    if (af) {
      if (!lastAf || af.getTime() > lastAf.getTime()) lastAf = af
    }
    if (cr) {
      if (!lastCr || cr.getTime() > lastCr.getTime()) lastCr = cr
    }
  }

  if (minY > maxY) {
    const now = new Date()
    minY = now.getFullYear()
    minM = 0
    maxY = minY
    maxM = 11
  }

  const points: AccProgressPoint[] = []
  const lastAfYear = lastAf?.getFullYear()
  const lastAfMonth0 = lastAf?.getMonth()
  const lastCrYear = lastCr?.getFullYear()
  const lastCrMonth0 = lastCr?.getMonth()
  let y = minY
  let m = minM
  while (y < maxY || (y === maxY && m <= maxM)) {
    const last = endOfMonth(y, m)
    let planCcoAcc = 0
    let planRfiAcc = 0
    let actualRfiAcc = 0
    let actualCrfiAcc = 0

    for (const r of rows) {
      const ff = parseTlpDate(r.ic_000010_ff)
      const af = parseTlpDate(r.ic_000010_af)
      const cr = parseTlpDate(r.rfi_accepted)

      if (ff && ff.getTime() <= last.getTime()) {
        planRfiAcc += 1
        if (isPlanCcoProgram(r.program_name)) {
          planCcoAcc += 1
        }
      }
      if (af && af.getTime() <= last.getTime()) {
        actualRfiAcc += 1
      }
      if (cr && cr.getTime() <= last.getTime()) {
        actualCrfiAcc += 1
      }
    }

    points.push({
      monthKey: monthKey(y, m),
      label: formatMonthLabel(y, m),
      planCcoAcc,
      planRfiAcc,
      actualRfiAcc:
        lastAfYear === undefined || lastAfMonth0 === undefined
          ? null
          : y > lastAfYear || (y === lastAfYear && m > lastAfMonth0)
            ? null
            : actualRfiAcc,
      actualCrfiAcc:
        lastCrYear === undefined || lastCrMonth0 === undefined
          ? null
          : y > lastCrYear || (y === lastCrYear && m > lastCrMonth0)
            ? null
            : actualCrfiAcc,
    })

    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }

  return trimAccProgressPointsWithNoActivity(points)
}

import { parseTlpDate } from "@/lib/tlp-acc-progress"

export const TLP_WEEKLY_METRIC_CONFIG = [
  { key: "crfi", label: "CRFI", dateField: "rfi_accepted" as const },
  { key: "rfi", label: "RFI", dateField: "ic_000010_af" as const },
  { key: "construction", label: "CONSTRUCTION", dateField: null },
  { key: "rfc", label: "RFC", dateField: null },
  { key: "sitac", label: "SITAC", dateField: null },
  { key: "searching", label: "SEARCHING", dateField: null },
  { key: "returnCount", label: "RETURN", dateField: null },
] as const

export type TlpWeeklyMetricKey = (typeof TLP_WEEKLY_METRIC_CONFIG)[number]["key"]

export type TlpWeeklyMetricCounts = Record<TlpWeeklyMetricKey, number>

export interface TlpWeeklyAchievementRow {
  weekIndex: number
  label: string
  counts: TlpWeeklyMetricCounts
  isMtd?: boolean
  /** True when this row is the calendar week containing the reference date. */
  isCurrentWeek?: boolean
}

export interface TlpWeeklyAchievementPayload {
  monthLabel: string
  year: number
  month: number
  weeks: TlpWeeklyAchievementRow[]
  mtd: TlpWeeklyMetricCounts
}

export type TlpWeeklyAchievementInputRow = {
  ic_000010_af?: string | null
  rfi_accepted?: string | null
}

function emptyCounts(): TlpWeeklyMetricCounts {
  return {
    crfi: 0,
    rfi: 0,
    construction: 0,
    rfc: 0,
    sitac: 0,
    searching: 0,
    returnCount: 0,
  }
}

function daysInYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return isLeap ? 366 : 365
}

/** Calendar week index from Jan 1 (W1 = days 1–7, W2 = days 8–14, …). */
export function getYearWeekIndexForDate(date: Date): number {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const dayOfYear =
    Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1
  const maxWeek = Math.ceil(daysInYear(year) / 7)
  return Math.min(Math.ceil(dayOfYear / 7), maxWeek)
}

/** Calendar weeks from Jan 1 (W1 = days 1–7, W2 = days 8–14, …) that intersect the reference month. */
export function getYearWeekBucketsForMonth(
  referenceDate = new Date()
): Array<{ weekIndex: number; label: string; start: Date; end: Date }> {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
  const totalDays = daysInYear(year)
  const totalWeeks = Math.ceil(totalDays / 7)
  const buckets: Array<{ weekIndex: number; label: string; start: Date; end: Date }> = []

  for (let w = 0; w < totalWeeks; w += 1) {
    const startDay = w * 7 + 1
    const endDay = Math.min((w + 1) * 7, totalDays)
    const start = new Date(year, 0, startDay, 0, 0, 0, 0)
    const end = new Date(year, 0, endDay, 23, 59, 59, 999)

    if (end < monthStart || start > monthEnd) continue
    if (start > referenceDate) continue

    const weekIndex = w + 1
    buckets.push({
      weekIndex,
      label: `W${weekIndex}`,
      start,
      end,
    })
  }

  return buckets
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

function isInCurrentMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month
}

function addAchievement(
  counts: TlpWeeklyMetricCounts,
  metricKey: "rfi" | "crfi"
): void {
  counts[metricKey] += 1
}

export function formatWeeklyMonthLabel(year: number, monthIndex0: number): string {
  const d = new Date(year, monthIndex0, 1)
  return d.toLocaleString("en-US", { month: "long", year: "numeric" })
}

export function buildWeeklyAchievementPayload(
  rows: TlpWeeklyAchievementInputRow[],
  referenceDate = new Date()
): TlpWeeklyAchievementPayload {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const monthLabel = formatWeeklyMonthLabel(year, month)
  const visibleWeeks = getYearWeekBucketsForMonth(referenceDate)
  const currentWeekIndex = getYearWeekIndexForDate(referenceDate)

  const weekRows: TlpWeeklyAchievementRow[] = visibleWeeks.map((bucket) => ({
    weekIndex: bucket.weekIndex,
    label: bucket.label,
    counts: emptyCounts(),
    isCurrentWeek: bucket.weekIndex === currentWeekIndex,
  }))

  const mtd = emptyCounts()

  const monthStart = new Date(year, month, 1, 0, 0, 0, 0)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)

  for (const row of rows) {
    const rfiDate = parseTlpDate(row.ic_000010_af)
    const crfiDate = parseTlpDate(row.rfi_accepted)

    if (rfiDate && isInCurrentMonth(rfiDate, year, month)) {
      if (isDateInRange(rfiDate, monthStart, monthEnd)) {
        addAchievement(mtd, "rfi")
      }
      for (const weekRow of weekRows) {
        const bucket = visibleWeeks.find((b) => b.weekIndex === weekRow.weekIndex)
        if (bucket && isDateInRange(rfiDate, bucket.start, bucket.end)) {
          addAchievement(weekRow.counts, "rfi")
        }
      }
    }

    if (crfiDate && isInCurrentMonth(crfiDate, year, month)) {
      if (isDateInRange(crfiDate, monthStart, monthEnd)) {
        addAchievement(mtd, "crfi")
      }
      for (const weekRow of weekRows) {
        const bucket = visibleWeeks.find((b) => b.weekIndex === weekRow.weekIndex)
        if (bucket && isDateInRange(crfiDate, bucket.start, bucket.end)) {
          addAchievement(weekRow.counts, "crfi")
        }
      }
    }
  }

  return {
    monthLabel,
    year,
    month: month + 1,
    weeks: weekRows,
    mtd,
  }
}

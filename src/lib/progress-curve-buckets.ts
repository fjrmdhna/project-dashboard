export type ProgressCurveBucket = {
  key: string
  /** Short axis label, e.g. "W27" or "Jun". */
  label: string
  /** Full date range for tooltip when a week crosses a month boundary. */
  periodLabel?: string
  start: Date
  end: Date
  kind: 'month' | 'week'
}

const clampRange = (s: Date, e: Date, min: Date, max: Date) => ({
  start: new Date(Math.max(+s, +min)),
  end: new Date(Math.min(+e, +max)),
})

/** ISO week-of-year number for labeling (e.g. W27). */
export function getProgressCurveWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Sunday 23:59:59.999 of the calendar week containing `date`. */
export function getSundayWeekEnd(date: Date): Date {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  const dayOfWeek = date.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + daysUntilSunday)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

function weekCrossesMonthBoundary(start: Date, end: Date): boolean {
  return end.getFullYear() !== start.getFullYear() || end.getMonth() !== start.getMonth()
}

function formatDayMonth(date: Date, includeYear = false): string {
  const day = date.getDate()
  const month = date.toLocaleString('en', { month: 'short' })
  return includeYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`
}

/** Short week label for the X-axis. */
export function formatProgressCurveWeekAxisLabel(weekNo: number): string {
  return `W${weekNo}`
}

/**
 * Tooltip date range for weeks that span months/years.
 * Example: "29 Jun – 5 Jul 2026" or "28 Dec 2026 – 3 Jan 2027"
 */
export function formatProgressCurveWeekPeriodLabel(start: Date, end: Date): string | undefined {
  if (!weekCrossesMonthBoundary(start, end)) {
    return undefined
  }
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDayMonth(start, true)} – ${formatDayMonth(end, true)}`
  }
  return `${formatDayMonth(start)} – ${formatDayMonth(end)} ${start.getFullYear()}`
}

/** @deprecated Use formatProgressCurveWeekAxisLabel for axis and formatProgressCurveWeekPeriodLabel for tooltip. */
export function formatProgressCurveWeekLabel(weekNo: number, start: Date, end: Date): string {
  return formatProgressCurveWeekAxisLabel(weekNo)
}

/**
 * Build week buckets for the anchor month. Weeks run through Sunday even when
 * that Sunday falls in the following month (no month-end clipping).
 */
export function buildProgressCurveWeekBuckets(
  monthStart: Date,
  monthEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): ProgressCurveBucket[] {
  const weeks: ProgressCurveBucket[] = []
  let cursor = new Date(monthStart)
  let weekCount = 0
  const maxWeeksPerMonth = 5

  while (cursor <= monthEnd && weekCount < maxWeeksPerMonth) {
    const weekStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      0,
      0,
      0,
      0,
    )
    const weekEndDate = getSundayWeekEnd(weekStart)
    const { start, end } = clampRange(weekStart, weekEndDate, rangeStart, rangeEnd)

    if (start <= end) {
      const weekNo = getProgressCurveWeekNumber(weekStart)
      const periodLabel = formatProgressCurveWeekPeriodLabel(start, end)
      const y = start.getFullYear()
      const m = String(start.getMonth() + 1).padStart(2, '0')
      const d = String(start.getDate()).padStart(2, '0')
      weeks.push({
        key: `${y}-${m}-${d}-w${weekNo}`,
        label: formatProgressCurveWeekAxisLabel(weekNo),
        ...(periodLabel ? { periodLabel } : {}),
        start,
        end,
        kind: 'week',
      })
    }

    const nextStart = new Date(weekEndDate)
    nextStart.setDate(nextStart.getDate() + 1)
    nextStart.setHours(0, 0, 0, 0)
    cursor = nextStart
    weekCount++
  }

  return weeks
}

import { describe, expect, it } from 'vitest'
import {
  buildProgressCurveWeekBuckets,
  formatProgressCurveWeekPeriodLabel,
  formatProgressCurveWeekAxisLabel,
} from './progress-curve-buckets'

const localDate = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms)

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('buildProgressCurveWeekBuckets', () => {
  it('extends the last week through Sunday even when that is in the next month', () => {
    const monthStart = localDate(2026, 6, 1)
    const monthEnd = localDate(2026, 6, 30, 23, 59, 59, 999)
    const rangeStart = localDate(2026, 1, 1)
    const rangeEnd = localDate(2026, 12, 31, 23, 59, 59, 999)

    const weeks = buildProgressCurveWeekBuckets(monthStart, monthEnd, rangeStart, rangeEnd)
    const w27 = weeks.find((w) => w.label === 'W27')

    expect(w27).toBeDefined()
    expect(fmt(w27!.start)).toBe('2026-06-29')
    expect(fmt(w27!.end)).toBe('2026-07-05')
    expect(w27!.label).toBe('W27')
    expect(w27!.periodLabel).toBe('29 Jun – 5 Jul 2026')
  })

  it('keeps full weeks that stay inside the month unchanged', () => {
    const monthStart = localDate(2026, 6, 1)
    const monthEnd = localDate(2026, 6, 30, 23, 59, 59, 999)
    const rangeStart = localDate(2026, 1, 1)
    const rangeEnd = localDate(2026, 12, 31, 23, 59, 59, 999)

    const weeks = buildProgressCurveWeekBuckets(monthStart, monthEnd, rangeStart, rangeEnd)
    const w24 = weeks.find((w) => w.label === 'W24')

    expect(w24).toBeDefined()
    expect(fmt(w24!.start)).toBe('2026-06-08')
    expect(fmt(w24!.end)).toBe('2026-06-14')
    expect(w24!.label).toBe('W24')
  })

  it('formats cross-year week period labels with both years', () => {
    const start = localDate(2026, 12, 28)
    const end = localDate(2027, 1, 3, 23, 59, 59, 999)
    expect(formatProgressCurveWeekAxisLabel(1)).toBe('W1')
    expect(formatProgressCurveWeekPeriodLabel(start, end)).toBe('28 Dec 2026 – 3 Jan 2027')
  })
})

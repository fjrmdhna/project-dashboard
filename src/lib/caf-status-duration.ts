/** Parse "8 Days 9 Hours" style duration into whole days (hours rounded down). */
export function parseStatusDurationDays(value: string | null | undefined): number | null {
  if (!value || !String(value).trim()) return null

  const match = String(value).match(/(\d+)\s*Days?\s*(?:(\d+)\s*Hours?)?/i)
  if (!match) return null

  const days = Number(match[1])
  if (Number.isNaN(days)) return null

  return days
}

export type CafAgingBucket = "under7" | "days8to14" | "days15to30" | "over30"

export function classifyAgingBucket(days: number): CafAgingBucket {
  if (days <= 7) return "under7"
  if (days <= 14) return "days8to14"
  if (days <= 30) return "days15to30"
  return "over30"
}

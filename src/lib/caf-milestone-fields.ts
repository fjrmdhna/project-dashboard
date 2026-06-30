import type { CafFilterableRow } from "@/lib/caf-filters"
import { extractRfsYear } from "@/lib/caf-filters"

export const CAF_MILESTONE_AF_COLUMNS = ["rfs_af", "endorse_af", "patp_accepted_af"] as const

export type CafMilestoneAfColumn = (typeof CAF_MILESTONE_AF_COLUMNS)[number]

export type CafMilestoneAlignmentData = {
  missingRfs: number
  missingEndorse: number
  missingPatp: number
  allComplete: number
  totalCaf: number
}

export type CafAfCompleteStatusItem = {
  status: string
  count: number
}

export type CafAfCompleteStatusSector = {
  label: string
  totalComplete: number
  items: CafAfCompleteStatusItem[]
}

export type CafAfCompleteStatusData = {
  /** Calendar year used to split RFS AF dates (current year at aggregation time). */
  splitYear: number
  totalComplete: number
  currentYear: CafAfCompleteStatusSector
  priorYears: CafAfCompleteStatusSector
}

function toSortedStatusItems(map: Map<string, number>): CafAfCompleteStatusItem[] {
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))
}

function emptyAfCompleteSector(label: string): CafAfCompleteStatusSector {
  return { label, totalComplete: 0, items: [] }
}

export function createEmptyCafAfCompleteStatusData(
  splitYear = new Date().getFullYear()
): CafAfCompleteStatusData {
  return {
    splitYear,
    totalComplete: 0,
    currentYear: emptyAfCompleteSector(String(splitYear)),
    priorYears: emptyAfCompleteSector(`Before ${splitYear}`),
  }
}

export function hasCafAfValue(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false
  const str = String(value).trim()
  if (str === "" || str === "null" || str === "undefined") return false
  return true
}

export function isCafAfMilestoneComplete(row: CafFilterableRow): boolean {
  return (
    hasCafAfValue(row.rfs_af) &&
    hasCafAfValue(row.endorse_af) &&
    hasCafAfValue(row.patp_accepted_af)
  )
}

export function computeCafMilestoneAlignment(rows: CafFilterableRow[]): CafMilestoneAlignmentData {
  let missingRfs = 0
  let missingEndorse = 0
  let missingPatp = 0
  let allComplete = 0

  for (const row of rows) {
    const hasRfs = hasCafAfValue(row.rfs_af)
    const hasEndorse = hasCafAfValue(row.endorse_af)
    const hasPatp = hasCafAfValue(row.patp_accepted_af)

    if (!hasRfs) missingRfs += 1
    if (!hasEndorse) missingEndorse += 1
    if (!hasPatp) missingPatp += 1
    if (hasRfs && hasEndorse && hasPatp) allComplete += 1
  }

  return {
    missingRfs,
    missingEndorse,
    missingPatp,
    allComplete,
    totalCaf: rows.length,
  }
}

export function computeCafAfCompleteStatusBreakdown(
  rows: CafFilterableRow[],
  splitYear = new Date().getFullYear()
): CafAfCompleteStatusData {
  const currentYearCounts = new Map<string, number>()
  const priorYearCounts = new Map<string, number>()
  let currentYearTotal = 0
  let priorYearsTotal = 0

  for (const row of rows) {
    if (!isCafAfMilestoneComplete(row)) continue

    const rfsYear = extractRfsYear(row.rfs_af)
    if (!rfsYear) continue

    const yearNum = Number.parseInt(rfsYear, 10)
    if (!Number.isFinite(yearNum)) continue

    const status = (row.caf_status ?? "Unknown").trim() || "Unknown"

    if (yearNum === splitYear) {
      currentYearTotal += 1
      currentYearCounts.set(status, (currentYearCounts.get(status) ?? 0) + 1)
    } else if (yearNum < splitYear) {
      priorYearsTotal += 1
      priorYearCounts.set(status, (priorYearCounts.get(status) ?? 0) + 1)
    }
  }

  return {
    splitYear,
    totalComplete: currentYearTotal + priorYearsTotal,
    currentYear: {
      label: String(splitYear),
      totalComplete: currentYearTotal,
      items: toSortedStatusItems(currentYearCounts),
    },
    priorYears: {
      label: `Before ${splitYear}`,
      totalComplete: priorYearsTotal,
      items: toSortedStatusItems(priorYearCounts),
    },
  }
}

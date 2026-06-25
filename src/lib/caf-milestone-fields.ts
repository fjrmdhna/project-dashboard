import type { CafFilterableRow } from "@/lib/caf-filters"

export const CAF_MILESTONE_AF_COLUMNS = ["rfs_af", "endorse_af", "patp_accepted_af"] as const

export type CafMilestoneAfColumn = (typeof CAF_MILESTONE_AF_COLUMNS)[number]

export type CafMilestoneAlignmentData = {
  missingRfs: number
  missingEndorse: number
  missingPatp: number
  allComplete: number
  totalCaf: number
}

export function hasCafAfValue(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false
  const str = String(value).trim()
  if (str === "" || str === "null" || str === "undefined") return false
  return true
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

import type { CafFilterableRow } from "@/lib/caf-filters"

export type CafMatrixStats = {
  totalCaf: number
  inReview: number
  approved: number
  implemented: number
  rejected: number
  notConfirmed: number
  resubmit: number
  other: number
}

function hasDate(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function normalizeType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function isRejectedStatus(status: string): boolean {
  return status.includes("reject")
}

export function isNotConfirmedStatus(status: string): boolean {
  return status.includes("not confirmed")
}

export function isInReviewStatus(status: string): boolean {
  return status.includes("waiting") && !status.includes("approve waiting")
}

export function isApprovedPendingStatus(status: string): boolean {
  return status.includes("approve waiting")
}

export function isImplementedStatus(
  status: string,
  row: Pick<CafFilterableRow, "implemented_date">
): boolean {
  return hasDate(row.implemented_date) || status.includes("fully implemented")
}

export function isActionablePendingStatus(
  row: Pick<CafFilterableRow, "caf_status" | "implemented_date">
): boolean {
  const status = normalizeStatus(row.caf_status)
  if (isRejectedStatus(status)) return false
  if (isImplementedStatus(status, row)) return false
  return true
}

export type CafPipelineBucket =
  | "implemented"
  | "approved"
  | "inReview"
  | "rejected"
  | "notConfirmed"
  | "other"

/** Mutually exclusive pipeline bucket for a single CAF row. */
export function classifyCafPipelineBucket(
  row: Pick<CafFilterableRow, "caf_status" | "implemented_date" | "approved_date">
): CafPipelineBucket {
  const status = normalizeStatus(row.caf_status)

  if (isRejectedStatus(status)) return "rejected"
  if (isNotConfirmedStatus(status)) return "notConfirmed"
  if (isImplementedStatus(status, row)) return "implemented"
  if (isApprovedPendingStatus(status) || hasDate(row.approved_date)) return "approved"
  if (isInReviewStatus(status)) return "inReview"
  return "other"
}

export function computeCafMatrixStats(rows: CafFilterableRow[]): CafMatrixStats {
  let inReview = 0
  let approved = 0
  let implemented = 0
  let rejected = 0
  let notConfirmed = 0
  let resubmit = 0
  let other = 0

  for (const row of rows) {
    const status = normalizeStatus(row.caf_status)

    if (normalizeType(row.caf_type) === "resubmit") resubmit += 1

    if (isRejectedStatus(status)) {
      rejected += 1
      continue
    }
    if (isNotConfirmedStatus(status)) {
      notConfirmed += 1
      continue
    }
    if (isImplementedStatus(status, row)) {
      implemented += 1
      continue
    }
    if (isApprovedPendingStatus(status) || hasDate(row.approved_date)) {
      approved += 1
      continue
    }
    if (isInReviewStatus(status)) {
      inReview += 1
      continue
    }

    other += 1
  }

  return {
    totalCaf: rows.length,
    inReview,
    approved,
    implemented,
    rejected,
    notConfirmed,
    resubmit,
    other,
  }
}

/** Mutually exclusive pipeline buckets (excludes resubmit overlay). */
export function sumMatrixPipelineBuckets(stats: CafMatrixStats): number {
  return stats.inReview + stats.approved + stats.implemented + stats.rejected + stats.notConfirmed + stats.other
}

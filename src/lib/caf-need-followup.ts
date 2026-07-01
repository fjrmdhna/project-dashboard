import type { CafFilterableRow } from "@/lib/caf-filters"
import { isCafAfMilestoneComplete } from "@/lib/caf-milestone-fields"
import { parseStatusDurationDays } from "@/lib/caf-status-duration"
import { resolveCafStatusId } from "@/lib/caf-status-registry"

/** Pipeline step 6 — Approve Waiting Implementation */
export const CAF_AWAITING_IMPL_STATUS_ID = 6

const MAX_VENDORS = 5

export type CafNeedFollowupVendorItem = {
  name: string
  count: number
}

export type CafNeedFollowupData = {
  /** Rows in Approve Waiting Implementation with all AF milestones filled. */
  total: number
  /** All rows in Approve Waiting Implementation (any AF state). */
  awaitingImplTotal: number
  shareOfAwaitingPct: number
  over30Days: number
  vendors: CafNeedFollowupVendorItem[]
}

export function isCafNeedFollowupRow(row: CafFilterableRow): boolean {
  return (
    resolveCafStatusId(row.caf_status) === CAF_AWAITING_IMPL_STATUS_ID &&
    isCafAfMilestoneComplete(row)
  )
}

export function createEmptyCafNeedFollowupData(): CafNeedFollowupData {
  return {
    total: 0,
    awaitingImplTotal: 0,
    shareOfAwaitingPct: 0,
    over30Days: 0,
    vendors: [],
  }
}

export function computeCafNeedFollowupData(rows: CafFilterableRow[]): CafNeedFollowupData {
  let total = 0
  let awaitingImplTotal = 0
  let over30Days = 0
  const vendorMap = new Map<string, number>()

  for (const row of rows) {
    if (resolveCafStatusId(row.caf_status) !== CAF_AWAITING_IMPL_STATUS_ID) continue

    awaitingImplTotal += 1

    if (!isCafAfMilestoneComplete(row)) continue

    total += 1

    const vendor = (row.vendor_tlp_name ?? "").trim() || "Unassigned"
    vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + 1)

    const days = parseStatusDurationDays(row.status_duration)
    if (days !== null && days > 30) over30Days += 1
  }

  const vendors = Array.from(vendorMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX_VENDORS)

  const shareOfAwaitingPct =
    awaitingImplTotal > 0 ? Math.round((total / awaitingImplTotal) * 100) : 0

  return {
    total,
    awaitingImplTotal,
    shareOfAwaitingPct,
    over30Days,
    vendors,
  }
}

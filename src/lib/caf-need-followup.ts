import { type CafFilterableRow } from "@/lib/caf-filters"
import { isCafAfMilestoneComplete } from "@/lib/caf-milestone-fields"
import { parseStatusDurationDays } from "@/lib/caf-status-duration"
import {
  CAF_STATUS_BY_ID,
  resolveCafStatusId,
  type CafStatusDefinition,
} from "@/lib/caf-status-registry"

/** Pipeline statuses shown in Need Follow-up card (AF-complete breakdown). */
export const CAF_NEED_FOLLOWUP_STATUS_IDS = [6, 7, 8] as const

export type CafNeedFollowupStatusId = (typeof CAF_NEED_FOLLOWUP_STATUS_IDS)[number]

/** @deprecated Use CAF_NEED_FOLLOWUP_STATUS_IDS — kept for existing imports. */
export const CAF_AWAITING_IMPL_STATUS_ID = 6 satisfies CafNeedFollowupStatusId

export type CafNeedFollowupVendorItem = {
  name: string
  count: number
}

export type CafNeedFollowupStatusGroup = {
  statusId: CafNeedFollowupStatusId
  label: string
  shortLabel: string
  color: string
  /** Rows in this status with all AF milestones filled. */
  total: number
  /** All rows in this status (any AF state). */
  statusTotal: number
  shareOfStatusPct: number
  over30Days: number
  vendors: CafNeedFollowupVendorItem[]
}

export type CafNeedFollowupData = {
  total: number
  statusTotal: number
  shareOfStatusPct: number
  over30Days: number
  groups: CafNeedFollowupStatusGroup[]
}

type StatusAccumulator = {
  total: number
  statusTotal: number
  over30Days: number
  vendorMap: Map<string, number>
}

function createEmptyStatusAccumulator(): StatusAccumulator {
  return { total: 0, statusTotal: 0, over30Days: 0, vendorMap: new Map() }
}

function emptyStatusGroup(definition: CafStatusDefinition): CafNeedFollowupStatusGroup {
  return {
    statusId: definition.id as CafNeedFollowupStatusId,
    label: definition.label,
    shortLabel: definition.shortLabel,
    color: definition.color,
    total: 0,
    statusTotal: 0,
    shareOfStatusPct: 0,
    over30Days: 0,
    vendors: [],
  }
}

function toVendorList(map: Map<string, number>): CafNeedFollowupVendorItem[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function bumpStatusFollowup(
  acc: StatusAccumulator,
  row: CafFilterableRow,
  includeInFollowup: boolean
) {
  acc.statusTotal += 1

  if (!includeInFollowup) return

  acc.total += 1

  const vendor = (row.vendor_tlp_name ?? "").trim() || "Unassigned"
  acc.vendorMap.set(vendor, (acc.vendorMap.get(vendor) ?? 0) + 1)

  const days = parseStatusDurationDays(row.status_duration)
  if (days !== null && days > 30) acc.over30Days += 1
}

function isNeedFollowupStatusId(statusId: number): statusId is CafNeedFollowupStatusId {
  return (CAF_NEED_FOLLOWUP_STATUS_IDS as readonly number[]).includes(statusId)
}

export function isCafNeedFollowupRow(row: CafFilterableRow): boolean {
  const statusId = resolveCafStatusId(row.caf_status)
  return isNeedFollowupStatusId(statusId) && isCafAfMilestoneComplete(row)
}

export function createEmptyCafNeedFollowupData(): CafNeedFollowupData {
  const groups = CAF_NEED_FOLLOWUP_STATUS_IDS.map((id) => {
    const definition = CAF_STATUS_BY_ID.get(id)
    if (!definition) {
      return emptyStatusGroup({
        id,
        label: "Unknown",
        shortLabel: "Unknown",
        phase: "legacy",
        color: "#64748B",
        picRole: "—",
      })
    }
    return emptyStatusGroup(definition)
  })

  return {
    total: 0,
    statusTotal: 0,
    shareOfStatusPct: 0,
    over30Days: 0,
    groups,
  }
}

function finalizeStatusGroup(
  definition: CafStatusDefinition,
  acc: StatusAccumulator
): CafNeedFollowupStatusGroup {
  const shareOfStatusPct =
    acc.statusTotal > 0 ? Math.round((acc.total / acc.statusTotal) * 100) : 0

  return {
    statusId: definition.id as CafNeedFollowupStatusId,
    label: definition.label,
    shortLabel: definition.shortLabel,
    color: definition.color,
    total: acc.total,
    statusTotal: acc.statusTotal,
    shareOfStatusPct,
    over30Days: acc.over30Days,
    vendors: toVendorList(acc.vendorMap),
  }
}

export function computeCafNeedFollowupData(rows: CafFilterableRow[]): CafNeedFollowupData {
  const accByStatus = new Map<CafNeedFollowupStatusId, StatusAccumulator>()
  for (const statusId of CAF_NEED_FOLLOWUP_STATUS_IDS) {
    accByStatus.set(statusId, createEmptyStatusAccumulator())
  }

  for (const row of rows) {
    const statusId = resolveCafStatusId(row.caf_status)
    if (!isNeedFollowupStatusId(statusId)) continue

    bumpStatusFollowup(
      accByStatus.get(statusId)!,
      row,
      isCafAfMilestoneComplete(row)
    )
  }

  const groups = CAF_NEED_FOLLOWUP_STATUS_IDS.map((statusId) => {
    const definition = CAF_STATUS_BY_ID.get(statusId)!
    return finalizeStatusGroup(definition, accByStatus.get(statusId)!)
  })

  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const statusTotal = groups.reduce((sum, group) => sum + group.statusTotal, 0)
  const over30Days = groups.reduce((sum, group) => sum + group.over30Days, 0)
  const shareOfStatusPct = statusTotal > 0 ? Math.round((total / statusTotal) * 100) : 0

  return {
    total,
    statusTotal,
    shareOfStatusPct,
    over30Days,
    groups,
  }
}

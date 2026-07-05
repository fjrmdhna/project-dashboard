import type { CafFilterableRow } from "@/lib/caf-filters"
import { parseStatusDurationDays } from "@/lib/caf-status-duration"
import {
  getCafRowAssigneeName,
  getCafStatusAssigneeLabel,
  resolveCafStatusAssigneeKind,
} from "@/lib/caf-status-assignee"
import {
  CAF_STATUS_BY_ID,
  resolveCafStatusId,
  type CafStatusDefinition,
} from "@/lib/caf-status-registry"

/** PIC follow-up groups shown in the left wallboard card (workflow order). */
export const CAF_PIC_PENDING_STATUS_IDS = [1, 2, 4, 5] as const

export type CafPicPendingStatusId = (typeof CAF_PIC_PENDING_STATUS_IDS)[number]

/** @deprecated Use CAF_PIC_PENDING_STATUS_IDS */
export const CAF_STAFF_CONFIRM_STATUS_ID = 1 satisfies CafPicPendingStatusId

/** Pipeline step 2 — Waiting for Review – TLP */
export const CAF_TLP_REVIEW_STATUS_ID = 2 satisfies CafPicPendingStatusId

/** Pipeline step 4 — Waiting for Approval - TLP */
export const CAF_TLP_APPROVAL_STATUS_ID = 4 satisfies CafPicPendingStatusId

/** Pipeline step 5 — Waiting Fully Implemented - AVP */
export const CAF_AVP_PENDING_STATUS_ID = 5 satisfies CafPicPendingStatusId

export type CafPicPendingItem = {
  name: string
  count: number
  over30Days: number
}

export type CafPicPendingGroup = {
  statusId: CafPicPendingStatusId
  statusLabel: string
  shortLabel: string
  color: string
  assigneeLabel: string
  total: number
  over30Days: number
  assignees: CafPicPendingItem[]
}

export type CafPicPendingData = {
  total: number
  over30Days: number
  groups: CafPicPendingGroup[]
}

type AssigneeAccumulator = {
  count: number
  over30Days: number
}

function emptyDefinition(statusId: number): CafStatusDefinition {
  return {
    id: statusId,
    label: "Unknown",
    shortLabel: "Unknown",
    phase: "legacy",
    color: "#64748B",
    picRole: "—",
  }
}

function isPicPendingStatusId(statusId: number): statusId is CafPicPendingStatusId {
  return (CAF_PIC_PENDING_STATUS_IDS as readonly number[]).includes(statusId)
}

function toAssigneeList(map: Map<string, AssigneeAccumulator>): CafPicPendingItem[] {
  return Array.from(map.entries())
    .map(([name, acc]) => ({
      name,
      count: acc.count,
      over30Days: acc.over30Days,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function finalizeGroup(
  definition: CafStatusDefinition,
  map: Map<string, AssigneeAccumulator>
): CafPicPendingGroup {
  const assignees = toAssigneeList(map)
  const total = assignees.reduce((sum, item) => sum + item.count, 0)
  const over30Days = assignees.reduce((sum, item) => sum + item.over30Days, 0)
  const assigneeKind = resolveCafStatusAssigneeKind(definition.label)

  return {
    statusId: definition.id as CafPicPendingStatusId,
    statusLabel: definition.label,
    shortLabel: definition.shortLabel,
    color: definition.color,
    assigneeLabel: getCafStatusAssigneeLabel(assigneeKind),
    total,
    over30Days,
    assignees,
  }
}

export function createEmptyCafPicPendingData(): CafPicPendingData {
  const groups = CAF_PIC_PENDING_STATUS_IDS.map((statusId) => {
    const definition = CAF_STATUS_BY_ID.get(statusId) ?? emptyDefinition(statusId)
    return finalizeGroup(definition, new Map())
  })

  return {
    total: 0,
    over30Days: 0,
    groups,
  }
}

export function isCafPicPendingRow(
  row: CafFilterableRow,
  statusId?: CafPicPendingStatusId
): boolean {
  const resolved = resolveCafStatusId(row.caf_status)
  if (statusId !== undefined) return resolved === statusId
  return isPicPendingStatusId(resolved)
}

export function bumpCafPicPending(
  map: Map<string, AssigneeAccumulator>,
  row: CafFilterableRow,
  statusLabel: string
) {
  const kind = resolveCafStatusAssigneeKind(statusLabel)
  const name = getCafRowAssigneeName(row, kind)
  const acc = map.get(name) ?? { count: 0, over30Days: 0 }
  acc.count += 1

  const days = parseStatusDurationDays(row.status_duration)
  if (days !== null && days > 30) acc.over30Days += 1

  map.set(name, acc)
}

export function finalizeCafPicPendingData(
  maps: Map<CafPicPendingStatusId, Map<string, AssigneeAccumulator>>
): CafPicPendingData {
  const groups = CAF_PIC_PENDING_STATUS_IDS.map((statusId) => {
    const definition = CAF_STATUS_BY_ID.get(statusId) ?? emptyDefinition(statusId)
    return finalizeGroup(definition, maps.get(statusId) ?? new Map())
  })

  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const over30Days = groups.reduce((sum, group) => sum + group.over30Days, 0)

  return { total, over30Days, groups }
}

export function computeCafPicPendingData(rows: CafFilterableRow[]): CafPicPendingData {
  const maps = new Map<CafPicPendingStatusId, Map<string, AssigneeAccumulator>>()
  for (const statusId of CAF_PIC_PENDING_STATUS_IDS) {
    maps.set(statusId, new Map())
  }

  for (const row of rows) {
    const statusId = resolveCafStatusId(row.caf_status)
    if (!isPicPendingStatusId(statusId)) continue

    const statusLabel = (row.caf_status ?? "").trim() || "Unknown"
    bumpCafPicPending(maps.get(statusId)!, row, statusLabel)
  }

  return finalizeCafPicPendingData(maps)
}

/** @deprecated Use CafPicPendingData */
export type CafStaffPendingData = CafPicPendingGroup & { staff: CafPicPendingItem[] }

/** @deprecated Use createEmptyCafPicPendingData */
export function createEmptyCafStaffPendingData(): CafPicPendingGroup {
  return createEmptyCafPicPendingData().groups[0]
}

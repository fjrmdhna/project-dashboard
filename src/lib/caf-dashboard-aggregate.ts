import { differenceInCalendarDays, format, startOfDay, subDays } from "date-fns"
import type { CafFilterableRow } from "@/lib/caf-filters"
import {
  classifyCafPipelineBucket,
  computeCafMatrixStats,
  isActionablePendingStatus,
  type CafMatrixStats,
  type CafPipelineBucket,
} from "@/lib/caf-matrix-stats"
import {
  classifyAgingBucket,
  parseStatusDurationDays,
  type CafAgingBucket,
} from "@/lib/caf-status-duration"
import {
  computeCafAfCompleteStatusBreakdown,
  computeCafMilestoneAlignment,
  type CafAfCompleteStatusData,
  type CafMilestoneAlignmentData,
} from "@/lib/caf-milestone-fields"
import {
  getCafRowAssigneeName,
  getCafStatusAssigneeLabel,
  resolveCafStatusAssigneeKind,
  type CafAssigneeKind,
} from "@/lib/caf-status-assignee"
import {
  bumpCafPicPending,
  CAF_PIC_PENDING_STATUS_IDS,
  finalizeCafPicPendingData,
  type CafPicPendingData,
  type CafPicPendingStatusId,
} from "@/lib/caf-pic-pending"
import {
  computeCafNeedFollowupData,
  type CafNeedFollowupData,
} from "@/lib/caf-need-followup"
import {
  computeCafStatusBreakdown,
  resolveCafStatusId,
  type CafStatusBreakdown,
} from "@/lib/caf-status-registry"

const MAX_FUNNEL_STATUSES = 10
const MAX_VENDOR_LEADERBOARD = 5
const MAX_STATUS_VENDOR_ITEMS = 6
const MAX_VENDORS_PER_STATUS = 3
const MAX_STATUS_ASSIGNEE_CARDS = 8

type VendorAgg = {
  count: number
  implemented: number
  approved: number
  inReview: number
  rejected: number
  notConfirmed: number
  other: number
}

function createEmptyVendorAgg(): VendorAgg {
  return {
    count: 0,
    implemented: 0,
    approved: 0,
    inReview: 0,
    rejected: 0,
    notConfirmed: 0,
    other: 0,
  }
}

function bumpVendorAgg(
  map: Map<string, VendorAgg>,
  value: string | null | undefined,
  bucket: CafPipelineBucket
) {
  const name = (value ?? "").trim() || "Unassigned"
  const agg = map.get(name) ?? createEmptyVendorAgg()
  agg.count += 1
  agg[bucket] += 1
  map.set(name, agg)
}

function bumpStatusVendorCount(
  map: Map<string, Map<string, number>>,
  status: string,
  vendor: string | null | undefined
) {
  const vendorName = (vendor ?? "").trim() || "Unassigned"
  const vendorMap = map.get(status) ?? new Map<string, number>()
  vendorMap.set(vendorName, (vendorMap.get(vendorName) ?? 0) + 1)
  map.set(status, vendorMap)
}

function bumpStatusAssigneeCount(
  map: Map<string, Map<string, number>>,
  status: string,
  assignee: string
) {
  const assigneeMap = map.get(status) ?? new Map<string, number>()
  assigneeMap.set(assignee, (assigneeMap.get(assignee) ?? 0) + 1)
  map.set(status, assigneeMap)
}

function toStatusAssigneeCards(
  statusCounts: Map<string, number>,
  assigneeMap: Map<string, Map<string, number>>
): CafStatusAssigneeCardData[] {
  return Array.from(statusCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_STATUS_ASSIGNEE_CARDS)
    .map(([status, count]) => {
      const assigneeKind = resolveCafStatusAssigneeKind(status)
      const assigneeCounts = assigneeMap.get(status) ?? new Map<string, number>()
      const assignees = Array.from(assigneeCounts.entries())
        .map(([name, assigneeCount]) => ({ name, count: assigneeCount }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      return {
        status,
        count,
        assigneeKind,
        assigneeLabel: getCafStatusAssigneeLabel(assigneeKind),
        assignees,
      }
    })
}

function toTopVendorList(map: Map<string, VendorAgg>, limit: number): CafVendorLeaderboardItem[] {
  return Array.from(map.entries())
    .map(([name, agg]) => ({
      name,
      count: agg.count,
      implemented: agg.implemented,
      approved: agg.approved,
      inReview: agg.inReview,
      rejected: agg.rejected,
      notConfirmed: agg.notConfirmed,
      other: agg.other,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

function toStatusVendorPendingList(
  map: Map<string, Map<string, number>>
): CafStatusVendorPendingItem[] {
  return Array.from(map.entries())
    .map(([status, vendorMap]) => {
      const totalCount = Array.from(vendorMap.values()).reduce((sum, value) => sum + value, 0)
      const vendors = Array.from(vendorMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, MAX_VENDORS_PER_STATUS)

      return {
        status,
        count: totalCount,
        vendors,
      }
    })
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))
    .slice(0, MAX_STATUS_VENDOR_ITEMS)
}

export type CafStatusFunnelItem = {
  status: string
  count: number
}

export type CafDailyRunrateItem = {
  date: string
  forecast: number
  actual: number
}

export type CafVendorLeaderboardItem = {
  name: string
  count: number
  implemented: number
  approved: number
  inReview: number
  rejected: number
  notConfirmed: number
  other: number
}

export type CafStatusVendorPendingItem = {
  status: string
  count: number
  vendors: Array<{ name: string; count: number }>
}

export type CafStatusAssigneeRow = {
  name: string
  count: number
}

export type CafStatusAssigneeCardData = {
  status: string
  count: number
  assigneeKind: CafAssigneeKind
  assigneeLabel: string
  assignees: CafStatusAssigneeRow[]
}

export type CafAgingData = {
  buckets: Record<CafAgingBucket, number>
  waitingImplementation: number
  pendingAging: number
  totalOpen: number
}

export type { CafMilestoneAlignmentData, CafAfCompleteStatusData } from "@/lib/caf-milestone-fields"

export type { CafNeedFollowupData } from "@/lib/caf-need-followup"

export type { CafPicPendingData } from "@/lib/caf-pic-pending"

export type { CafStatusBreakdown } from "@/lib/caf-status-registry"

export type CafDashboardData = {
  matrix: CafMatrixStats
  statusBreakdown: CafStatusBreakdown
  statusFunnel: {
    items: CafStatusFunnelItem[]
    totalCaf: number
  }
  aging: CafAgingData
  milestoneAlignment: CafMilestoneAlignmentData
  afCompleteStatus: CafAfCompleteStatusData
  picPending: CafPicPendingData
  needFollowup: CafNeedFollowupData
  dailyRunrate: CafDailyRunrateItem[]
  topVendorRequestor: CafVendorLeaderboardItem[]
  topVendorTlp: CafVendorLeaderboardItem[]
  statusVendorPending: CafStatusVendorPendingItem[]
  statusAssigneeCards: CafStatusAssigneeCardData[]
}

function hasDate(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function parseRunrateDate(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null

  const raw = String(value).trim()
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildRunrateWindow(endDate: Date = new Date()): Array<{ formatted: string; sqlDate: string }> {
  const end = startOfDay(endDate)
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(end, 6 - i)
    return {
      formatted: format(date, "dd-MMM-yy"),
      sqlDate: format(date, "yyyy-MM-dd"),
    }
  })
}

/** Anchor runrate to latest CAF activity when the dataset lags behind calendar today. */
export function resolveCafRunrateAnchorDate(rows: CafFilterableRow[]): Date {
  const today = startOfDay(new Date())
  let latestMs = 0

  for (const row of rows) {
    for (const raw of [row.created_date, row.approved_date]) {
      const parsed = parseRunrateDate(raw)
      if (!parsed) continue
      const ms = parsed.getTime()
      if (ms > latestMs) latestMs = ms
    }
  }

  if (latestMs === 0) return today

  const latest = startOfDay(new Date(latestMs))
  const gapDays = differenceInCalendarDays(today, latest)

  if (gapDays <= 6) return today

  return latest
}

function toSqlDateKey(value: string | null | undefined, dateSet: Set<string>): string | null {
  const parsed = parseRunrateDate(value)
  if (!parsed) return null

  const dateKey = format(parsed, "yyyy-MM-dd")
  return dateSet.has(dateKey) ? dateKey : null
}

/** Single-pass aggregation — one scan of rows for all CAF dashboard cards. */
export function aggregateCafDashboard(rows: CafFilterableRow[]): CafDashboardData {
  const matrix = computeCafMatrixStats(rows)

  const statusCounts = new Map<string, number>()
  const buckets: Record<CafAgingBucket, number> = {
    under7: 0,
    days8to14: 0,
    days15to30: 0,
    over30: 0,
  }

  let waitingImplementation = 0
  let pendingAging = 0
  let totalOpen = 0

  const runrateAnchor = resolveCafRunrateAnchorDate(rows)
  const runrateWindow = buildRunrateWindow(runrateAnchor)
  const dateSet = new Set(runrateWindow.map((d) => d.sqlDate))
  const createdMap: Record<string, number> = {}
  const approvedMap: Record<string, number> = {}
  const vendorRequestorCounts = new Map<string, VendorAgg>()
  const vendorTlpCounts = new Map<string, VendorAgg>()
  const statusVendorPendingMap = new Map<string, Map<string, number>>()
  const statusAssigneeMap = new Map<string, Map<string, number>>()
  const picPendingMaps = new Map<
    CafPicPendingStatusId,
    Map<string, { count: number; over30Days: number }>
  >()
  for (const statusId of CAF_PIC_PENDING_STATUS_IDS) {
    picPendingMaps.set(statusId, new Map())
  }

  for (const row of rows) {
    const status = (row.caf_status ?? "Unknown").trim() || "Unknown"
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)

    const assigneeKind = resolveCafStatusAssigneeKind(status)
    const assigneeName = getCafRowAssigneeName(row, assigneeKind)
    bumpStatusAssigneeCount(statusAssigneeMap, status, assigneeName)

    const bucket = classifyCafPipelineBucket(row)
    bumpVendorAgg(vendorRequestorCounts, row.vendor_requestor_name, bucket)
    bumpVendorAgg(vendorTlpCounts, row.vendor_tlp_name, bucket)

    if (isActionablePendingStatus(row)) {
      bumpStatusVendorCount(statusVendorPendingMap, status, row.vendor_tlp_name)
    }

    const statusId = resolveCafStatusId(status)
    if ((CAF_PIC_PENDING_STATUS_IDS as readonly number[]).includes(statusId)) {
      bumpCafPicPending(picPendingMaps.get(statusId as CafPicPendingStatusId)!, row, status)
    }

    const createdKey = toSqlDateKey(row.created_date, dateSet)
    if (createdKey) createdMap[createdKey] = (createdMap[createdKey] ?? 0) + 1

    const approvedKey = toSqlDateKey(row.approved_date, dateSet)
    if (approvedKey) approvedMap[approvedKey] = (approvedMap[approvedKey] ?? 0) + 1

    if (hasDate(row.implemented_date)) continue

    totalOpen += 1

    const statusLower = (row.caf_status ?? "").trim().toLowerCase()
    if (statusLower.includes("approve waiting implementation")) {
      waitingImplementation += 1
    }

    const days = parseStatusDurationDays(row.status_duration)
    if (days === null) continue

    pendingAging += 1
    buckets[classifyAgingBucket(days)] += 1
  }

  const funnelItems = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_FUNNEL_STATUSES)

  const dailyRunrate = runrateWindow.map(({ formatted, sqlDate }) => ({
    date: formatted,
    forecast: createdMap[sqlDate] ?? 0,
    actual: approvedMap[sqlDate] ?? 0,
  }))

  return {
    matrix,
    statusBreakdown: computeCafStatusBreakdown(rows),
    statusFunnel: {
      items: funnelItems,
      totalCaf: rows.length,
    },
    aging: {
      buckets,
      waitingImplementation,
      pendingAging,
      totalOpen,
    },
    milestoneAlignment: computeCafMilestoneAlignment(rows),
    afCompleteStatus: computeCafAfCompleteStatusBreakdown(rows),
    picPending: finalizeCafPicPendingData(picPendingMaps),
    needFollowup: computeCafNeedFollowupData(rows),
    dailyRunrate,
    topVendorRequestor: toTopVendorList(vendorRequestorCounts, MAX_VENDOR_LEADERBOARD),
    topVendorTlp: toTopVendorList(vendorTlpCounts, MAX_VENDOR_LEADERBOARD),
    statusVendorPending: toStatusVendorPendingList(statusVendorPendingMap),
    statusAssigneeCards: toStatusAssigneeCards(statusCounts, statusAssigneeMap),
  }
}

export function sumFunnelCounts(items: CafStatusFunnelItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0)
}

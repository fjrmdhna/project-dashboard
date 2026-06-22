import { format, subDays } from "date-fns"
import type { CafFilterableRow } from "@/lib/caf-filters"
import { computeCafMatrixStats, type CafMatrixStats } from "@/lib/caf-matrix-stats"
import {
  classifyAgingBucket,
  parseStatusDurationDays,
  type CafAgingBucket,
} from "@/lib/caf-status-duration"

const MAX_FUNNEL_STATUSES = 10
const MAX_VENDOR_LEADERBOARD = 5

function bumpVendorCount(map: Map<string, number>, value: string | null | undefined) {
  const name = (value ?? "").trim() || "Unassigned"
  map.set(name, (map.get(name) ?? 0) + 1)
}

function toTopVendorList(map: Map<string, number>, limit: number): CafVendorLeaderboardItem[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
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
}

export type CafAgingData = {
  buckets: Record<CafAgingBucket, number>
  waitingImplementation: number
  pendingAging: number
  totalOpen: number
}

export type CafDashboardData = {
  matrix: CafMatrixStats
  statusFunnel: {
    items: CafStatusFunnelItem[]
    totalCaf: number
  }
  aging: CafAgingData
  dailyRunrate: CafDailyRunrateItem[]
  topVendorRequestor: CafVendorLeaderboardItem[]
  topVendorTlp: CafVendorLeaderboardItem[]
}

function hasDate(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function buildRunrateWindow(): Array<{ formatted: string; sqlDate: string }> {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i)
    return {
      formatted: format(date, "dd-MMM-yy"),
      sqlDate: format(date, "yyyy-MM-dd"),
    }
  })
}

function toSqlDateKey(value: string | null | undefined, dateSet: Set<string>): string | null {
  if (!value) return null
  try {
    const dateKey = format(new Date(value), "yyyy-MM-dd")
    return dateSet.has(dateKey) ? dateKey : null
  } catch {
    return null
  }
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

  const runrateWindow = buildRunrateWindow()
  const dateSet = new Set(runrateWindow.map((d) => d.sqlDate))
  const createdMap: Record<string, number> = {}
  const approvedMap: Record<string, number> = {}
  const vendorRequestorCounts = new Map<string, number>()
  const vendorTlpCounts = new Map<string, number>()

  for (const row of rows) {
    const status = (row.caf_status ?? "Unknown").trim() || "Unknown"
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)

    bumpVendorCount(vendorRequestorCounts, row.vendor_requestor_name)
    bumpVendorCount(vendorTlpCounts, row.vendor_tlp_name)

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
    dailyRunrate,
    topVendorRequestor: toTopVendorList(vendorRequestorCounts, MAX_VENDOR_LEADERBOARD),
    topVendorTlp: toTopVendorList(vendorTlpCounts, MAX_VENDOR_LEADERBOARD),
  }
}

export function sumFunnelCounts(items: CafStatusFunnelItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0)
}

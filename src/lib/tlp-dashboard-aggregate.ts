import { buildAccProgressCurveFromRows, type AccProgressPoint } from "@/lib/tlp-acc-progress"
import { normalizeTlpCircleKey, resolveTlpCircleLabel } from "@/lib/tlp-circle"
import {
  buildTlpIssueCategoryRows,
  isCountableTlpIssueCategory,
} from "@/lib/tlp-issue-category"
import { buildProgramSiteCategoryPayload, type TlpProgramSiteCategoryPayload } from "@/lib/tlp-program-site-category"
import { buildRfiNotCrfiIssuePayload, type TlpRfiNotCrfiIssuePayload } from "@/lib/tlp-rfi-not-crfi-issue"
import { buildSiteReturnPayload, type TlpSiteReturnPayload } from "@/lib/tlp-site-return"
import { buildWeeklyAchievementPayload, type TlpWeeklyAchievementPayload } from "@/lib/tlp-weekly-achievement"
import { buildTopVendorsWithOthers, type TlpVendorPlanActual } from "@/lib/tlp-vendor-aggregation"
import { hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import type { TlpDashboardRow } from "@/lib/tlp-dashboard-server"
import type { TlpIssueCategoryRow } from "@/lib/tlp-issue-category"

const TOP_VENDOR_N = 5

export interface TlpMatrixStatsData {
  totalSites: number
  crfi: number
  rfi: number
  construction: number
  rfc: number
  sitac: number
  searching: number
  returnCount: number
}

export interface TlpRfiByCircleItem {
  circle: string
  plan: number
  actual: number
  total: number
}

export interface TlpDashboardAggregated {
  matrix: TlpMatrixStatsData
  rfiByCircle: TlpRfiByCircleItem[]
  totalPlanRfi: number
  totalActualRfi: number
  topVendorRfi: TlpVendorPlanActual[]
  accProgress: AccProgressPoint[]
  issues: TlpIssueCategoryRow[]
  categoryCount: number
  totalIssues: number
  programSiteCategory: TlpProgramSiteCategoryPayload
  rfiNotCrfi: TlpRfiNotCrfiIssuePayload
  weeklyAchievement: TlpWeeklyAchievementPayload
  siteReturn: TlpSiteReturnPayload
}

function normalizeTlpSiteStatus(value: unknown): string {
  if (!hasNonEmptyValue(value)) return ""
  const normalized = String(value).trim().toUpperCase()

  if (normalized.includes("PROPOSED RETURN")) return "RETURN"
  if (normalized.includes("RETURN")) return "RETURN"
  if (normalized.includes("CONSTRUCTION")) return "CONSTRUCTION"
  if (normalized.includes("SEARCHING")) return "SEARCHING"
  if (normalized.includes("SITAC")) return "SITAC"
  if (normalized.includes("CRFI")) return "CRFI"
  if (normalized.includes("SRFI")) return "RFI"
  if (normalized.includes("RFI")) return "RFI"
  if (normalized.includes("RFC")) return "RFC"

  return normalized
}

function buildMatrixStats(rows: TlpDashboardRow[]): TlpMatrixStatsData {
  const stats: TlpMatrixStatsData = {
    totalSites: 0,
    crfi: 0,
    rfi: 0,
    construction: 0,
    rfc: 0,
    sitac: 0,
    searching: 0,
    returnCount: 0,
  }

  for (const row of rows) {
    stats.totalSites += 1
    const siteStatus = normalizeTlpSiteStatus(row.site_status)
    switch (siteStatus) {
      case "CRFI":
        stats.crfi += 1
        break
      case "RFI":
        stats.rfi += 1
        break
      case "CONSTRUCTION":
        stats.construction += 1
        break
      case "RFC":
        stats.rfc += 1
        break
      case "SITAC":
        stats.sitac += 1
        break
      case "SEARCHING":
        stats.searching += 1
        break
      case "RETURN":
        stats.returnCount += 1
        break
      default:
        break
    }
  }

  return stats
}

function buildRfiByCircle(rows: TlpDashboardRow[]): {
  circles: TlpRfiByCircleItem[]
  totalPlanRfi: number
  totalActualRfi: number
} {
  const circleMap = new Map<string, { label: string; total: number; plan: number; actual: number }>()

  for (const row of rows) {
    const groupKey = normalizeTlpCircleKey(row.region_circle) ?? "unknown"
    const label = hasNonEmptyValue(row.region_circle)
      ? resolveTlpCircleLabel(row.region_circle)
      : "Unknown"

    const item = circleMap.get(groupKey) ?? { label, total: 0, plan: 0, actual: 0 }
    item.total += 1
    if (hasNonEmptyValue(row.ic_000010_ff)) item.plan += 1
    if (hasNonEmptyValue(row.ic_000010_af)) item.actual += 1
    circleMap.set(groupKey, item)
  }

  const circles = Array.from(circleMap.values())
    .map((value) => ({
      circle: value.label,
      plan: value.plan,
      actual: value.actual,
      total: value.total,
    }))
    .sort((a, b) => b.actual - a.actual)

  return {
    circles,
    totalPlanRfi: circles.reduce((sum, item) => sum + item.plan, 0),
    totalActualRfi: circles.reduce((sum, item) => sum + item.actual, 0),
  }
}

function buildTopVendorRfi(rows: TlpDashboardRow[]): TlpVendorPlanActual[] {
  const vendorMap = new Map<string, { plan: number; actual: number }>()

  for (const row of rows) {
    const vendor = hasNonEmptyValue(row.twr_owner) ? String(row.twr_owner).trim().toUpperCase() : "UNKNOWN"
    const item = vendorMap.get(vendor) ?? { plan: 0, actual: 0 }
    if (hasNonEmptyValue(row.ic_000010_ff)) item.plan += 1
    if (hasNonEmptyValue(row.ic_000010_af)) item.actual += 1
    vendorMap.set(vendor, item)
  }

  const allVendors: TlpVendorPlanActual[] = Array.from(vendorMap.entries()).map(([vendor, counts]) => ({
    vendor,
    plan: counts.plan,
    actual: counts.actual,
  }))

  return buildTopVendorsWithOthers(allVendors, TOP_VENDOR_N)
}

function buildIssues(rows: TlpDashboardRow[]): {
  issues: TlpIssueCategoryRow[]
  categoryCount: number
  totalIssues: number
} {
  const categoryCount: Record<string, number> = {}

  for (const row of rows) {
    const raw = row.issue_category
    if (!isCountableTlpIssueCategory(raw)) continue
    const key = String(raw).trim()
    categoryCount[key] = (categoryCount[key] ?? 0) + 1
  }

  const issues = buildTlpIssueCategoryRows(categoryCount)
  const totalIssues = issues.reduce((sum, item) => sum + item.count, 0)

  return {
    issues,
    categoryCount: issues.length,
    totalIssues,
  }
}

export function aggregateTlpDashboard(rows: TlpDashboardRow[]): TlpDashboardAggregated {
  const matrix = buildMatrixStats(rows)
  const rfiCircle = buildRfiByCircle(rows)
  const issueData = buildIssues(rows)

  return {
    matrix,
    rfiByCircle: rfiCircle.circles,
    totalPlanRfi: rfiCircle.totalPlanRfi,
    totalActualRfi: rfiCircle.totalActualRfi,
    topVendorRfi: buildTopVendorRfi(rows),
    accProgress: buildAccProgressCurveFromRows(rows),
    issues: issueData.issues,
    categoryCount: issueData.categoryCount,
    totalIssues: issueData.totalIssues,
    programSiteCategory: buildProgramSiteCategoryPayload(rows),
    rfiNotCrfi: buildRfiNotCrfiIssuePayload(rows),
    weeklyAchievement: buildWeeklyAchievementPayload(rows),
    siteReturn: buildSiteReturnPayload(rows),
  }
}

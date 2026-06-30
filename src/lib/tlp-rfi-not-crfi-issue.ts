import { hasNonEmptyValue } from "@/lib/tlp-new-site-server"
import { resolveTlpCircleLabel } from "@/lib/tlp-circle"

export const TLP_RFI_GAP_UNSPECIFIED_ISSUE = "Unspecified Issue"

export const TLP_ALLOWED_RAN_VENDORS = ["Huawei", "Nokia"] as const

/** Region colors aligned with reference dashboard (Jakarta Raya, Java, Kalisumapa, Sumatera). */
export const TLP_REGION_CIRCLE_COLORS: Record<string, string> = {
  "Jakarta Raya": "#1E3A8A",
  Java: "#0D9488",
  Kalisumapa: "#D97706",
  Sumatera: "#7C3AED",
  Unknown: "rgba(255,255,255,0.28)",
}

export type TlpRfiNotCrfiIssueRow = {
  label: string
  ranVendor: string
  issueCategory: string
  regionCounts: Record<string, number>
  total: number
}

export type TlpRfiNotCrfiIssuePayload = {
  rows: TlpRfiNotCrfiIssueRow[]
  regions: string[]
  totalIssues: number
  /** RFI–CRFI gap sites skipped because ran_vendor is empty. */
  skippedWithoutRanVendor: number
}

export function hasTlpRfi(ic000010Af: unknown): boolean {
  return hasNonEmptyValue(ic000010Af)
}

export function hasTlpCrfi(rfiAccepted: unknown): boolean {
  return hasNonEmptyValue(rfiAccepted)
}

/** Site has RFI (ic_000010_af) but not yet CRFI (rfi_accepted). */
export function isRfiNotCrfiRow(row: {
  ic_000010_af?: unknown
  rfi_accepted?: unknown
}): boolean {
  return hasTlpRfi(row.ic_000010_af) && !hasTlpCrfi(row.rfi_accepted)
}

export function isCountableIssueCategory(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const s = String(value).trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (lower.includes("no issue")) return false
  return true
}

export function normalizeRanVendor(value: unknown): (typeof TLP_ALLOWED_RAN_VENDORS)[number] | null {
  if (!hasNonEmptyValue(value)) return null
  const v = String(value).trim().toLowerCase()
  if (v.includes("huawei") || v === "hw") return "Huawei"
  if (v.includes("nokia") || v === "nok") return "Nokia"
  return null
}

export function resolveRanVendor(row: { ran_vendor?: unknown }): (typeof TLP_ALLOWED_RAN_VENDORS)[number] | null {
  return normalizeRanVendor(row.ran_vendor)
}

export function resolveGapIssueCategory(value: unknown): string {
  if (isCountableIssueCategory(value)) return String(value).trim()
  return TLP_RFI_GAP_UNSPECIFIED_ISSUE
}

/** Display label: always `[ran_vendor] - [issue_category]`. */
export function formatRfiGapRowLabel(ranVendor: string, issueCategory: string): string {
  const vendor = ranVendor.trim()
  const issue = issueCategory.trim()
  if (!vendor) return issue
  if (!issue) return vendor
  return `${vendor} - ${issue}`
}

export function resolveGapRegionCircle(value: unknown): string {
  if (!hasNonEmptyValue(value)) return "Unknown"
  return resolveTlpCircleLabel(value)
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

export function sortRegionCircles(regions: Iterable<string>): string[] {
  const unique = [...new Set(regions)]
  const preferred = ["Jakarta Raya", "Java", "Kalisumapa", "Sumatera", "Unknown"]
  const ordered = preferred.filter((r) => unique.includes(r))
  const extras = unique.filter((r) => !preferred.includes(r)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras]
}

export function buildRfiNotCrfiIssuePayload(
  rows: Array<{
    ic_000010_af?: string | null
    rfi_accepted?: string | null
    ran_vendor?: string | null
    issue_category?: string | null
    region_circle?: string | null
  }>
): TlpRfiNotCrfiIssuePayload {
  const bucketMap = new Map<
    string,
    { ranVendor: string; issueCategory: string; regionCounts: Record<string, number> }
  >()
  let skippedWithoutRanVendor = 0

  for (const row of rows) {
    if (!isRfiNotCrfiRow(row)) continue

    const ranVendor = resolveRanVendor(row)
    if (!ranVendor) {
      skippedWithoutRanVendor += 1
      continue
    }

    const issueCategory = resolveGapIssueCategory(row.issue_category)
    const region = resolveGapRegionCircle(row.region_circle)

    const bucketKey = `${ranVendor}|${issueCategory}`
    const bucket = bucketMap.get(bucketKey) ?? { ranVendor, issueCategory, regionCounts: {} }
    bucket.regionCounts[region] = (bucket.regionCounts[region] ?? 0) + 1
    bucketMap.set(bucketKey, bucket)
  }

  const allRegions = new Set<string>()
  for (const bucket of bucketMap.values()) {
    for (const region of Object.keys(bucket.regionCounts)) allRegions.add(region)
  }

  const regions = sortRegionCircles(allRegions)

  const chartRows: TlpRfiNotCrfiIssueRow[] = Array.from(bucketMap.values())
    .map((bucket) => ({
      label: formatRfiGapRowLabel(bucket.ranVendor, bucket.issueCategory),
      ranVendor: bucket.ranVendor,
      issueCategory: bucket.issueCategory,
      regionCounts: bucket.regionCounts,
      total: sumCounts(bucket.regionCounts),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

  const totalIssues = chartRows.reduce((sum, row) => sum + row.total, 0)

  return { rows: chartRows, regions, totalIssues, skippedWithoutRanVendor }
}

export function toRfiNotCrfiChartRows(
  rows: TlpRfiNotCrfiIssueRow[],
  regions: string[]
): Array<Record<string, string | number>> {
  return rows.map((row) => {
    const entry: Record<string, string | number> = {
      label: row.label,
      total: row.total,
    }
    for (const region of regions) {
      entry[region] = row.regionCounts[region] ?? 0
    }
    return entry
  })
}

export function truncateIssueLabel(label: string, maxLen = 32): string {
  if (label.length <= maxLen) return label
  return `${label.slice(0, maxLen - 1)}…`
}

export function regionColor(region: string): string {
  return TLP_REGION_CIRCLE_COLORS[region] ?? "#64748B"
}

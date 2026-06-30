import { hasNonEmptyValue } from "@/lib/tlp-new-site-server"

/** Preferred display order for TLP `region` codes (aligned with Site Return report). */
export const TLP_RETURN_REGION_ORDER = [
  "BRO",
  "JRO",
  "CJRO",
  "EJRO",
  "SPRO",
  "KRO",
  "KJRO",
  "WJRO",
  "SSRO",
  "NSRO",
  "BNRO",
  "CSRO",
] as const

/** Workflow stages from return_replacement_status (Site Return dashboard). */
export const TLP_RETURN_STATUS_ORDER = [
  "1.1 Initial RAN Planning",
  "1.2 Waiting SA TLP",
  "2.1 Data Transport Preparation",
  "4.1 WO Preparation",
  "4.2 WO Released",
] as const

export type TlpReturnStatusKey = (typeof TLP_RETURN_STATUS_ORDER)[number]

export const TLP_RETURN_STATUS_COLORS: Record<string, string> = {
  "1.1 Initial RAN Planning": "#7C3AED",
  "1.2 Waiting SA TLP": "#F59E0B",
  "2.1 Data Transport Preparation": "#3B82F6",
  "4.1 WO Preparation": "#14B8A6",
  "4.2 WO Released": "#EC4899",
  "1.4-Commercial Review": "#A855F7",
  "3.1-RFI Target Preparation": "#6366F1",
  "5.1-Order Preparation to TMG": "#F97316",
  Other: "rgba(255,255,255,0.28)",
}

export const TLP_RETURN_STATUS_SHORT: Record<string, string> = {
  "1.1 Initial RAN Planning": "1.1 RAN",
  "1.2 Waiting SA TLP": "1.2 SA",
  "2.1 Data Transport Preparation": "2.1 DT",
  "4.1 WO Preparation": "4.1 WO",
  "4.2 WO Released": "4.2 Rel",
  "1.4-Commercial Review": "1.4 Comm",
  "3.1-RFI Target Preparation": "3.1 RFI",
  "5.1-Order Preparation to TMG": "5.1 Order",
  Other: "Other",
}

export const TLP_RETURN_WO_RELEASED_STATUS: TlpReturnStatusKey = "4.2 WO Released"

export type TlpReturnStatusCounts = Record<string, number>

export type TlpSiteReturnRow = {
  region: string
  statusCounts: TlpReturnStatusCounts
  total: number
  woReleased: number
}

export type TlpSiteReturnPayload = {
  statuses: string[]
  rows: TlpSiteReturnRow[]
  statusTotals: TlpReturnStatusCounts
  woReleasedTotal: number
  inProcessTotal: number
  grandTotal: number
  /** Return sites skipped because return_replacement_status is empty. */
  skippedWithoutStatus: number
}

export function isTlpReturnSite(row: { return_replacement_status?: unknown }): boolean {
  return hasNonEmptyValue(row.return_replacement_status)
}

export function normalizeTlpRegion(value: unknown): string {
  if (!hasNonEmptyValue(value)) return "Unknown"
  return String(value).trim().toUpperCase()
}

/** Normalize Excel export labels (e.g. `1.1-Initial RAN Planning`) for display grouping. */
function normalizeExcelStatusLabel(raw: string): string {
  return raw.trim().replace(/^(\d+\.\d+)-\s*/, "$1 ")
}

export function normalizeReturnReplacementStatus(value: unknown): string | null {
  if (!hasNonEmptyValue(value)) return null
  const raw = String(value).trim()
  const normalized = normalizeExcelStatusLabel(raw)
  const lower = normalized.toLowerCase()

  if (lower.includes("wo release") || lower.includes("released") || lower.includes("4.2")) {
    return TLP_RETURN_WO_RELEASED_STATUS
  }
  if (lower.includes("wo prep") || lower.includes("4.1")) {
    return "4.1 WO Preparation"
  }
  if (lower.includes("transport") || lower.includes("2.1")) {
    return "2.1 Data Transport Preparation"
  }
  if (lower.includes("waiting sa") || lower.includes("1.2")) {
    return "1.2 Waiting SA TLP"
  }
  if (lower.includes("ran plan") || lower.includes("initial") || lower.includes("1.1")) {
    return "1.1 Initial RAN Planning"
  }
  if (lower.includes("commercial") || lower.includes("1.4")) {
    return "1.4-Commercial Review"
  }
  if (lower.includes("rfi target") || lower.includes("3.1")) {
    return "3.1-RFI Target Preparation"
  }
  if (lower.includes("order preparation") || lower.includes("5.1")) {
    return "5.1-Order Preparation to TMG"
  }

  const exact = TLP_RETURN_STATUS_ORDER.find((status) => status.toLowerCase() === lower)
  if (exact) return exact

  return normalized
}

export function resolveReturnReplacementStatus(row: {
  return_replacement_status?: string | null
}): string | null {
  return normalizeReturnReplacementStatus(row.return_replacement_status)
}

function sumCounts(counts: TlpReturnStatusCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

export function sortTlpReturnRegions(regions: Iterable<string>): string[] {
  const unique = [...new Set(regions)]
  const ordered = TLP_RETURN_REGION_ORDER.filter((code) => unique.includes(code))
  const extras = unique
    .filter((code) => !TLP_RETURN_REGION_ORDER.includes(code as (typeof TLP_RETURN_REGION_ORDER)[number]))
    .sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras]
}

export function sortTlpReturnStatuses(statuses: Iterable<string>): string[] {
  const unique = new Set(statuses)
  const ordered = TLP_RETURN_STATUS_ORDER.filter((status) => unique.has(status))
  const extras = [...unique]
    .filter((status) => !TLP_RETURN_STATUS_ORDER.includes(status as TlpReturnStatusKey))
    .sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras]
}

export function buildSiteReturnPayload(
  rows: Array<{
    region?: string | null
    return_replacement_status?: string | null
    site_status?: string | null
  }>
): TlpSiteReturnPayload {
  const regionMap = new Map<string, TlpReturnStatusCounts>()
  const statusTotals: TlpReturnStatusCounts = {}
  let skippedWithoutStatus = 0

  for (const row of rows) {
    if (!isTlpReturnSite(row)) {
      const lower = String(row.site_status ?? "").toLowerCase()
      if (lower.includes("return") || lower.includes("proposed return")) {
        skippedWithoutStatus += 1
      }
      continue
    }

    const status = resolveReturnReplacementStatus(row)
    if (!status) {
      skippedWithoutStatus += 1
      continue
    }

    const region = normalizeTlpRegion(row.region)
    const regionCounts = regionMap.get(region) ?? {}
    regionCounts[status] = (regionCounts[status] ?? 0) + 1
    regionMap.set(region, regionCounts)

    statusTotals[status] = (statusTotals[status] ?? 0) + 1
  }

  const allStatuses = sortTlpReturnStatuses(Object.keys(statusTotals))

  const chartRows: TlpSiteReturnRow[] = sortTlpReturnRegions(regionMap.keys())
    .map((region) => {
      const statusCounts = regionMap.get(region) ?? {}
      const total = sumCounts(statusCounts)
      const woReleased = statusCounts[TLP_RETURN_WO_RELEASED_STATUS] ?? 0
      return { region, statusCounts, total, woReleased }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.region.localeCompare(b.region))

  const grandTotal = chartRows.reduce((sum, row) => sum + row.total, 0)
  const woReleasedTotal = statusTotals[TLP_RETURN_WO_RELEASED_STATUS] ?? 0
  const inProcessTotal = Math.max(0, grandTotal - woReleasedTotal)

  return {
    statuses: allStatuses,
    rows: chartRows,
    statusTotals,
    woReleasedTotal,
    inProcessTotal,
    grandTotal,
    skippedWithoutStatus,
  }
}

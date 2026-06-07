import { hasNonEmptyValue } from "@/lib/tlp-new-site-server"

export const TLP_GAP_OTHERS_LABEL = "Others"
export const TLP_GAP_UNSPECIFIED_ISSUE = "Unspecified Issue"

export type TlpRfiCrfiGapRow = {
  issueCategory: string
  count: number
}

export function hasTlpRfi(ic000010Af: unknown): boolean {
  return hasNonEmptyValue(ic000010Af)
}

export function hasTlpCrfi(rfiAccepted: unknown): boolean {
  return hasNonEmptyValue(rfiAccepted)
}

/** Site has RFI (ic_000010_af) but not yet CRFI (rfi_accepted). */
export function isRfiCrfiGapRow(row: {
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

export function resolveGapIssueCategory(value: unknown): string {
  if (isCountableIssueCategory(value)) {
    return String(value).trim()
  }
  return TLP_GAP_UNSPECIFIED_ISSUE
}

export function buildTopGapIssuesWithOthers(
  categories: TlpRfiCrfiGapRow[],
  topN: number,
  othersLabel = TLP_GAP_OTHERS_LABEL
): TlpRfiCrfiGapRow[] {
  const sorted = [...categories].sort(
    (a, b) => b.count - a.count || a.issueCategory.localeCompare(b.issueCategory)
  )

  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN)

  if (rest.length === 0) {
    return top
  }

  const others: TlpRfiCrfiGapRow = {
    issueCategory: othersLabel,
    count: rest.reduce((sum, row) => sum + row.count, 0),
  }

  return [...top, others]
}

export function sortGapChartRows(rows: TlpRfiCrfiGapRow[]): TlpRfiCrfiGapRow[] {
  const top = rows.filter((row) => row.issueCategory !== TLP_GAP_OTHERS_LABEL)
  const others = rows.find((row) => row.issueCategory === TLP_GAP_OTHERS_LABEL)

  const sortedTop = [...top].sort(
    (a, b) => b.count - a.count || a.issueCategory.localeCompare(b.issueCategory)
  )

  return others ? [...sortedTop, others] : sortedTop
}

export function truncateChartLabel(label: string, max = 32): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

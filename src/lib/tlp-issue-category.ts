export type TlpIssueCategoryRow = {
  category: string
  count: number
  color: string
}

export const TLP_ISSUE_CHART_COLORS = [
  "#FF6B6B",
  "#F7B267",
  "#4ECDC4",
  "#5DA3FA",
  "#C792EA",
  "#F472B6",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#38BDF8",
  "#FB7185",
  "#2DD4BF",
] as const

export function isCountableTlpIssueCategory(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const s = String(value).trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (lower.includes("no issue")) return false
  return true
}

export function buildTlpIssueCategoryRows(
  categoryCount: Record<string, number>
): TlpIssueCategoryRow[] {
  return Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a || 0)
    .map(([category, count], index) => ({
      category,
      count,
      color: TLP_ISSUE_CHART_COLORS[index % TLP_ISSUE_CHART_COLORS.length],
    }))
}

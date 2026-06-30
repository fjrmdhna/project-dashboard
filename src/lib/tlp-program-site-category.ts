import { hasNonEmptyValue } from "@/lib/tlp-new-site-server"

export const TLP_UNNAMED_PROJECT = "Unnamed Project"

/** Fallback program group when `program_group` is empty in source export. */
export const TLP_OTHER_PROGRAM_GROUP = "Other"

/** Program groups included in TLP New Site dashboard scope (Supabase + UI). */
export const TLP_SCOPED_PROGRAM_GROUPS = [
  "CO 2025",
  "AOP 2026 - Capacity",
  "AOP 2026 - Coverage",
] as const

export type TlpScopedProgramGroup = (typeof TLP_SCOPED_PROGRAM_GROUPS)[number]

/** Preferred sort order when these program groups exist in source data. */
export const TLP_PREFERRED_PROGRAM_GROUP_ORDER = [
  ...TLP_SCOPED_PROGRAM_GROUPS,
  TLP_OTHER_PROGRAM_GROUP,
] as const

export function isTlpScopedProgramGroup(value: unknown): value is TlpScopedProgramGroup {
  if (!hasNonEmptyValue(value)) return false
  return (TLP_SCOPED_PROGRAM_GROUPS as readonly string[]).includes(String(value).trim())
}

/** Preferred legend order for site category buckets. */
export const TLP_SITE_CATEGORY_ORDER = [
  "Add Pole",
  "B2S",
  "Collocation",
  "New Site",
  "Other",
] as const

export type TlpSiteCategoryBucket = (typeof TLP_SITE_CATEGORY_ORDER)[number]

export const TLP_SITE_CATEGORY_COLORS: Record<string, string> = {
  "Add Pole": "#8B5CF6",
  B2S: "#3B82F6",
  Collocation: "#10B981",
  "New Site": "#F59E0B",
  Other: "rgba(255,255,255,0.32)",
}

export type TlpCategoryCounts = Record<string, number>

export interface TlpProgramGroupRow {
  programGroup: string
  counts: TlpCategoryCounts
  total: number
}

export interface TlpProjectGroupRow {
  projectName: string
  counts: TlpCategoryCounts
  total: number
}

export interface TlpProgramSiteCategoryPayload {
  categories: string[]
  groups: TlpProgramGroupRow[]
  projectsByGroup: Record<string, TlpProjectGroupRow[]>
  grandTotal: number
}

export function normalizeTlpSiteCategoryBucket(value: unknown): string {
  if (!hasNonEmptyValue(value)) return "Other"

  const raw = String(value).trim()
  const lower = raw.toLowerCase()

  if (lower.includes("add pole")) return "Add Pole"
  if (lower.includes("b2s")) return "B2S"
  if (lower.includes("collocation") || lower.includes("colo")) return "Collocation"
  if (lower === "new site" || lower === "existing") return "New Site"

  return "Other"
}

export function resolveTlpProgramGroup(row: { program_group?: unknown }): string {
  if (!hasNonEmptyValue(row.program_group)) return TLP_OTHER_PROGRAM_GROUP
  return String(row.program_group).trim()
}

export function resolveTlpProjectName(row: { project_name?: unknown }): string {
  if (hasNonEmptyValue(row.project_name)) return String(row.project_name).trim()
  return TLP_UNNAMED_PROJECT
}

function addCount(map: TlpCategoryCounts, category: string, amount = 1): void {
  map[category] = (map[category] ?? 0) + amount
}

function sumCounts(counts: TlpCategoryCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

export function sortTlpSiteCategories(categories: Iterable<string>): string[] {
  const unique = new Set(categories)
  const ordered = TLP_SITE_CATEGORY_ORDER.filter((c) => unique.has(c))
  const extras = [...unique]
    .filter((c) => !TLP_SITE_CATEGORY_ORDER.includes(c as TlpSiteCategoryBucket))
    .sort((a, b) => a.localeCompare(b))
  return [...ordered, ...extras]
}

export function sortTlpProgramGroups(groups: TlpProgramGroupRow[]): TlpProgramGroupRow[] {
  return [...groups].sort((a, b) => {
    if (a.programGroup === TLP_OTHER_PROGRAM_GROUP) return 1
    if (b.programGroup === TLP_OTHER_PROGRAM_GROUP) return -1

    const orderA = TLP_PREFERRED_PROGRAM_GROUP_ORDER.indexOf(
      a.programGroup as (typeof TLP_PREFERRED_PROGRAM_GROUP_ORDER)[number]
    )
    const orderB = TLP_PREFERRED_PROGRAM_GROUP_ORDER.indexOf(
      b.programGroup as (typeof TLP_PREFERRED_PROGRAM_GROUP_ORDER)[number]
    )
    if (orderA !== -1 && orderB !== -1) return orderA - orderB
    if (orderA !== -1) return -1
    if (orderB !== -1) return 1
    return b.total - a.total || a.programGroup.localeCompare(b.programGroup)
  })
}

export function buildProgramSiteCategoryPayload(
  rows: Array<{
    program_group?: unknown
    program_name?: unknown
    project_name?: unknown
    site_category?: unknown
  }>
): TlpProgramSiteCategoryPayload {
  const groupCounts = new Map<string, TlpCategoryCounts>()
  const projectCounts = new Map<string, Map<string, TlpCategoryCounts>>()

  for (const row of rows) {
    const programGroup = resolveTlpProgramGroup(row)
    const projectName = resolveTlpProjectName(row)
    const bucket = normalizeTlpSiteCategoryBucket(row.site_category)

    const groupMap = groupCounts.get(programGroup) ?? {}
    addCount(groupMap, bucket)
    groupCounts.set(programGroup, groupMap)

    const projectsForGroup = projectCounts.get(programGroup) ?? new Map<string, TlpCategoryCounts>()
    const projectMap = projectsForGroup.get(projectName) ?? {}
    addCount(projectMap, bucket)
    projectsForGroup.set(projectName, projectMap)
    projectCounts.set(programGroup, projectsForGroup)
  }

  const allCategories = new Set<string>()
  for (const counts of groupCounts.values()) {
    for (const key of Object.keys(counts)) allCategories.add(key)
  }

  const categories = sortTlpSiteCategories(allCategories)

  const groups: TlpProgramGroupRow[] = sortTlpProgramGroups(
    Array.from(groupCounts.entries()).map(([programGroup, counts]) => ({
      programGroup,
      counts,
      total: sumCounts(counts),
    }))
  )

  const projectsByGroup: Record<string, TlpProjectGroupRow[]> = {}
  for (const [programGroup, projectMap] of projectCounts.entries()) {
    projectsByGroup[programGroup] = Array.from(projectMap.entries())
      .map(([projectName, counts]) => ({
        projectName,
        counts,
        total: sumCounts(counts),
      }))
      .sort((a, b) => b.total - a.total || a.projectName.localeCompare(b.projectName))
  }

  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0)

  return { categories, groups, projectsByGroup, grandTotal }
}

export function toStackedChartRows(
  items: Array<{ label: string; counts: TlpCategoryCounts }>,
  categories: string[]
): Array<Record<string, string | number>> {
  return items.map((item) => {
    const row: Record<string, string | number> = { label: item.label }
    let total = 0
    for (const category of categories) {
      const value = item.counts[category] ?? 0
      row[category] = value
      total += value
    }
    row.total = total
    return row
  })
}

export function truncateChartLabel(label: string, maxLen = 28): string {
  if (label.length <= maxLen) return label
  return `${label.slice(0, maxLen - 1)}…`
}

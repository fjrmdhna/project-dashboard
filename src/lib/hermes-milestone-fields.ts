/** Extra Matrix Statistics milestone inserted after Activated */
export interface HermesExtraMatrixMilestone {
  key: string
  column: string
  label: string
}

export interface HermesMilestoneFields {
  /** DB column for readiness count (e.g. readiness_2600_af) */
  readinessColumn: string
  /** DB column for activation count (e.g. activation_2600_af) */
  activatedColumn: string
  /** Matrix stats label for readiness milestone */
  readinessLabel: string
  /** Matrix stats label for activated milestone */
  activatedLabel: string
  /** Readiness chart header badge */
  readinessCardTitle: string
  /** Activation chart header badge */
  activatedCardTitle: string
  /** Optional extra matrix metrics shown after Activated (NR 2600 → Activated 700) */
  extraMatrixMilestones?: readonly HermesExtraMatrixMilestone[]
}

export const NR_2600_ACTIVATED_700_MILESTONE: HermesExtraMatrixMilestone = {
  key: "activated700",
  column: "activation_700_af",
  label: "ACTIVATED 700",
}

export const NR_2600_MILESTONE_FIELDS: HermesMilestoneFields = {
  readinessColumn: "readiness_2600_af",
  activatedColumn: "activation_2600_af",
  readinessLabel: "READINESS 2600",
  activatedLabel: "ACTIVATED 2600",
  readinessCardTitle: "2600 Readiness by City",
  activatedCardTitle: "2600 Activation by City",
  extraMatrixMilestones: [NR_2600_ACTIVATED_700_MILESTONE],
}

/** Metric key for pre-aggregated city bar charts */
export type HermesCityMetricKey = "ready" | "mos"

export interface HermesCityBarChartTheme {
  pendingColor: string
  achievedColor: string
  iconBgClass: string
  iconTextClass: string
  badgeBgClass: string
  badgeTextClass: string
  cardClassName: string
}

export const HERMES_READINESS_CITY_CHART_THEME: HermesCityBarChartTheme = {
  pendingColor: "#8A5AA3",
  achievedColor: "#7CB342",
  iconBgClass: "bg-purple-500/20",
  iconTextClass: "text-purple-400",
  badgeBgClass: "bg-purple-500/20",
  badgeTextClass: "text-purple-300",
  cardClassName: "readiness-card",
}

export const HERMES_MOS_CITY_CHART_THEME: HermesCityBarChartTheme = {
  pendingColor: "#4A6FA5",
  achievedColor: "#29B6F6",
  iconBgClass: "bg-sky-500/20",
  iconTextClass: "text-sky-400",
  badgeBgClass: "bg-sky-500/20",
  badgeTextClass: "text-sky-300",
  cardClassName: "mos-city-card",
}

/** Config for a city-level milestone bar chart (reuses FiveGReadinessCard) */
export interface HermesCityMilestoneCardConfig {
  milestoneColumn: string
  achievedMetricKey: HermesCityMetricKey
  cardTitle: string
  achievedLabel: string
  pendingLabel: string
  chartTheme?: HermesCityBarChartTheme
}

export const NR_2600_MOS_BY_CITY_CARD: HermesCityMilestoneCardConfig = {
  milestoneColumn: "mos_af",
  achievedMetricKey: "mos",
  cardTitle: "MOS by City",
  achievedLabel: "MOS",
  pendingLabel: "NY MOS",
  chartTheme: HERMES_MOS_CITY_CHART_THEME,
}

export function resolveMilestoneColumns(
  milestoneFields?: Pick<HermesMilestoneFields, "readinessColumn" | "activatedColumn">
) {
  return {
    readinessColumn: milestoneFields?.readinessColumn ?? "imp_integ_af",
    activatedColumn: milestoneFields?.activatedColumn ?? "rfs_af",
  }
}

export function isMilestoneAchieved(row: object, column: string): boolean {
  const value = (row as Record<string, unknown>)[column]
  return value != null && String(value).trim() !== ""
}

export function getExtraMatrixMilestones(
  milestoneFields?: HermesMilestoneFields
): readonly HermesExtraMatrixMilestone[] {
  return milestoneFields?.extraMatrixMilestones ?? []
}

export function createExtraMilestoneCounts(
  extras: readonly HermesExtraMatrixMilestone[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const extra of extras) counts[extra.key] = 0
  return counts
}

export function incrementExtraMilestoneCounts(
  row: object,
  extras: readonly HermesExtraMatrixMilestone[],
  counts: Record<string, number>
): void {
  for (const extra of extras) {
    if (isMilestoneAchieved(row, extra.column)) counts[extra.key]++
  }
}

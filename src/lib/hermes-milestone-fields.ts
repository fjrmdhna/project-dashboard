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
}

export const NR_2600_MILESTONE_FIELDS: HermesMilestoneFields = {
  readinessColumn: "readiness_2600_af",
  activatedColumn: "activation_2600_af",
  readinessLabel: "READINESS 2600",
  activatedLabel: "ACTIVATED 2600",
  readinessCardTitle: "2600 Readiness by City",
  activatedCardTitle: "2600 Activation by City",
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

import type { SiteData5G } from "./supabase"
import type { HermesMilestoneFields } from "./hermes-milestone-fields"
import { isMilestoneAchieved, resolveMilestoneColumns } from "./hermes-milestone-fields"

export const HERMES_MAP_STATUS = {
  sow: "SOW",
  rfi: "RFI",
  ready: "READY",
  active: "ACTIVE",
} as const

export type HermesMapStatusLabel = (typeof HERMES_MAP_STATUS)[keyof typeof HERMES_MAP_STATUS]

export const HERMES_MAP_STATUS_COLORS: Record<HermesMapStatusLabel, string> = {
  [HERMES_MAP_STATUS.active]: "#22C55E",
  [HERMES_MAP_STATUS.ready]: "#2563EB",
  [HERMES_MAP_STATUS.rfi]: "#FACC15",
  [HERMES_MAP_STATUS.sow]: "#EF4444",
}

export function resolveHermesMapStatus(
  row: SiteData5G | Record<string, unknown>,
  milestoneFields?: Pick<HermesMilestoneFields, "readinessColumn" | "activatedColumn">
): HermesMapStatusLabel {
  const { readinessColumn, activatedColumn } = resolveMilestoneColumns(milestoneFields)

  if (isMilestoneAchieved(row, activatedColumn)) {
    return HERMES_MAP_STATUS.active
  }

  if (isMilestoneAchieved(row, readinessColumn)) {
    return HERMES_MAP_STATUS.ready
  }

  if ((row as SiteData5G).caf_approved) {
    return HERMES_MAP_STATUS.rfi
  }

  return HERMES_MAP_STATUS.sow
}

export function getHermesMapStatusLabel(
  status: HermesMapStatusLabel,
  milestoneFields?: HermesMilestoneFields
): string {
  if (status === HERMES_MAP_STATUS.ready && milestoneFields?.readinessLabel) {
    return milestoneFields.readinessLabel
  }
  if (status === HERMES_MAP_STATUS.active && milestoneFields?.activatedLabel) {
    return milestoneFields.activatedLabel
  }
  return status
}

import {
  countExtraMilestones,
  getExtraMatrixMilestones,
  isMilestoneAchieved,
  resolveMilestoneColumns,
  type HermesMilestoneFields,
} from "@/lib/hermes-milestone-fields"

export interface HermesMatrixExportStatRow {
  label: string
  count: number
  column: string
  scope: string
}

type MatrixRow = Record<string, unknown>

function countAchieved(rows: MatrixRow[], column: string): number {
  return rows.filter((row) => isMilestoneAchieved(row, column)).length
}

/** Build matrix summary rows using the same rules as MatrixStatsCard on the dashboard. */
export function computeHermesMatrixExportStats(
  mainRows: MatrixRow[],
  supplementalRows: MatrixRow[] = [],
  milestoneFields?: HermesMilestoneFields
): HermesMatrixExportStatRow[] {
  const { readinessColumn, activatedColumn } = resolveMilestoneColumns(milestoneFields)
  const extraMilestones = getExtraMatrixMilestones(milestoneFields)
  const extraCounts = countExtraMilestones(extraMilestones, mainRows, supplementalRows)
  const mainScope = "Dashboard scope (13k)"

  const baseMetrics: HermesMatrixExportStatRow[] = [
    { label: "TOTAL SITES", count: mainRows.length, column: "system_key", scope: mainScope },
    { label: "CAF", count: countAchieved(mainRows, "caf_approved"), column: "caf_approved", scope: mainScope },
    { label: "MOS", count: countAchieved(mainRows, "mos_af"), column: "mos_af", scope: mainScope },
    { label: "INSTALL", count: countAchieved(mainRows, "ic_000040_af"), column: "ic_000040_af", scope: mainScope },
    {
      label: milestoneFields?.readinessLabel ?? "READINESS",
      count: countAchieved(mainRows, readinessColumn),
      column: readinessColumn,
      scope: mainScope,
    },
    {
      label: milestoneFields?.activatedLabel ?? "ACTIVATED",
      count: countAchieved(mainRows, activatedColumn),
      column: activatedColumn,
      scope: mainScope,
    },
  ]

  const trailingMetrics: HermesMatrixExportStatRow[] = [
    {
      label: "RFA",
      count: countAchieved(mainRows, "ready_for_acpt_date"),
      column: "ready_for_acpt_date",
      scope: mainScope,
    },
    {
      label: milestoneFields?.rfcLabel ?? "RFC",
      count: countAchieved(mainRows, "rfc_approved"),
      column: "rfc_approved",
      scope: mainScope,
    },
    {
      label: "FATP",
      count: countAchieved(mainRows, "fatp_accepted_af"),
      column: "fatp_accepted_af",
      scope: mainScope,
    },
    {
      label: "PATP",
      count: countAchieved(mainRows, "patp_accepted_af"),
      column: "patp_accepted_af",
      scope: mainScope,
    },
    {
      label: "HN",
      count: countAchieved(mainRows, "hotnews_af"),
      column: "hotnews_af",
      scope: mainScope,
    },
    {
      label: "ENDORSE",
      count: countAchieved(mainRows, "endorse_af"),
      column: "endorse_af",
      scope: mainScope,
    },
    {
      label: "PAC",
      count: countAchieved(mainRows, "pac_accepted_af"),
      column: "pac_accepted_af",
      scope: mainScope,
    },
  ]

  const extraMetricRows = extraMilestones.map((milestone) => ({
    label: milestone.label,
    count: extraCounts[milestone.key] ?? 0,
    column: milestone.column,
    scope: milestone.programReport ? `program_report = ${milestone.programReport}` : mainScope,
  }))

  const activatedIndex = baseMetrics.findIndex(
    (metric) => metric.label === (milestoneFields?.activatedLabel ?? "ACTIVATED")
  )
  const insertAt = activatedIndex >= 0 ? activatedIndex + 1 : baseMetrics.length

  return [
    ...baseMetrics.slice(0, insertAt),
    ...extraMetricRows,
    ...baseMetrics.slice(insertAt),
    ...trailingMetrics,
  ]
}

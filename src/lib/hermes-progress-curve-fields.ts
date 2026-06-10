export interface HermesProgressCurveFields {
  /** Actual readiness milestone date column */
  readinessColumn: string
  /** Actual activation milestone date column */
  activatedColumn: string
  /** Vendor commitment readiness date column */
  commitmentReadinessColumn: string
  /** Vendor commitment activation date column */
  commitmentActivatedColumn: string
  readinessLabel: string
  activatedLabel: string
  commitmentReadinessLabel: string
  commitmentActivatedLabel: string
  /**
   * When false, commitment lines use plain cumulative counts (NR 2600).
   * When true/undefined, legacy Hermes cap-to-actual logic applies in elapsed buckets.
   */
  capCommitmentToActual?: boolean
  /** When true, actual milestone lines (readiness/activated) stop at present time. */
  clipActualSeriesToPresent?: boolean
}

export const DEFAULT_HERMES_PROGRESS_CURVE_FIELDS: HermesProgressCurveFields = {
  readinessColumn: "imp_integ_af",
  activatedColumn: "rfs_af",
  commitmentReadinessColumn: "mocn_activation_forecast",
  commitmentActivatedColumn: "rfs_forecast_lock",
  readinessLabel: "Readiness",
  activatedLabel: "Activated",
  commitmentReadinessLabel: "Plan 5G Readiness",
  commitmentActivatedLabel: "Plan 5G Activated",
}

export const NR_2600_PROGRESS_CURVE_FIELDS: HermesProgressCurveFields = {
  readinessColumn: "readiness_2600_af",
  activatedColumn: "activation_2600_af",
  commitmentReadinessColumn: "rfs_forecast",
  commitmentActivatedColumn: "rfs_forecast_lock",
  readinessLabel: "Readiness 2600",
  activatedLabel: "Activated 2600",
  commitmentReadinessLabel: "Commitment Readiness Vendor",
  commitmentActivatedLabel: "Commitment Activated Vendor",
  capCommitmentToActual: false,
  clipActualSeriesToPresent: true,
}

export function resolveProgressCurveFields(
  fields?: HermesProgressCurveFields
): HermesProgressCurveFields {
  return fields ?? DEFAULT_HERMES_PROGRESS_CURVE_FIELDS
}

export function getRowDateValue(row: object, column: string): string | null | undefined {
  const value = (row as Record<string, unknown>)[column]
  if (value == null) return null
  const str = String(value).trim()
  return str === "" ? null : str
}

export type HermesDailyRunrateMilestone = "readiness" | "activated"

export interface HermesDailyRunrateSeries {
  commitmentColumn: string
  actualColumn: string
  commitmentLabel: string
  actualLabel: string
}

/** Daily runrate column/label pair from progress curve config (readiness or activated). */
export function resolveDailyRunrateSeries(
  progressCurveFields?: HermesProgressCurveFields,
  milestone: HermesDailyRunrateMilestone = "activated"
): HermesDailyRunrateSeries {
  if (progressCurveFields) {
    if (milestone === "readiness") {
      return {
        commitmentColumn: progressCurveFields.commitmentReadinessColumn,
        actualColumn: progressCurveFields.readinessColumn,
        commitmentLabel: progressCurveFields.commitmentReadinessLabel,
        actualLabel: progressCurveFields.readinessLabel,
      }
    }

    return {
      commitmentColumn: progressCurveFields.commitmentActivatedColumn,
      actualColumn: progressCurveFields.activatedColumn,
      commitmentLabel: progressCurveFields.commitmentActivatedLabel,
      actualLabel: progressCurveFields.activatedLabel,
    }
  }

  return {
    commitmentColumn: "rfs_ff",
    actualColumn: "rfs_af",
    commitmentLabel: "Forecast",
    actualLabel: "Actual",
  }
}

export function incrementDailyRunrateCount(
  dateValue: string | null | undefined,
  dateSet: Set<string>,
  countsByDate: Map<string, number>
): void {
  if (!dateValue) return
  const dateKey = dateValue.trim().substring(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !dateSet.has(dateKey)) return
  countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1)
}

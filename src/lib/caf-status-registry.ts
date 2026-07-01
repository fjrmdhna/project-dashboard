import type { CafFilterableRow } from "@/lib/caf-filters"

export type CafStatusPhase = "active" | "approval" | "terminal_success" | "terminal_failure" | "legacy"

export interface CafStatusDefinition {
  /** Pipeline display order (1–10), matches CAF Monitoring workflow bar. */
  id: number
  label: string
  shortLabel: string
  phase: CafStatusPhase
  color: string
  picRole: string
}

/**
 * CAF Monitoring pipeline — 10 statuses in business workflow order.
 * (Not the same numbering as caf_detail.status_id 1–13 in the backend.)
 */
export const CAF_STATUS_DEFINITIONS: readonly CafStatusDefinition[] = [
  {
    id: 1,
    label: "Waiting for Confirmation - Staff",
    shortLabel: "Staff",
    phase: "active",
    color: "#F59E0B",
    picRole: "Staff",
  },
  {
    id: 2,
    label: "Waiting for Review – TLP",
    shortLabel: "TLP Rev",
    phase: "active",
    color: "#FBBF24",
    picRole: "Vendor TLP",
  },
  {
    id: 3,
    label: "Waiting for Confirmation - Site Management",
    shortLabel: "Site Mgmt",
    phase: "active",
    color: "#F97316",
    picRole: "Site Management",
  },
  {
    id: 4,
    label: "Waiting for Approval - TLP",
    shortLabel: "TLP Appr",
    phase: "active",
    color: "#EAB308",
    picRole: "Vendor TLP",
  },
  {
    id: 5,
    label: "Waiting Fully Implemented - AVP",
    shortLabel: "AVP",
    phase: "approval",
    color: "#38BDF8",
    picRole: "AVP",
  },
  {
    id: 6,
    label: "Approve Waiting Implementation",
    shortLabel: "Await Impl",
    phase: "approval",
    color: "#3B82F6",
    picRole: "Vendor TLP",
  },
  {
    id: 7,
    label: "Waiting Fully Implemented - TLP",
    shortLabel: "TLP Final",
    phase: "approval",
    color: "#60A5FA",
    picRole: "Vendor TLP",
  },
  {
    id: 8,
    label: "Fully Implemented",
    shortLabel: "Done",
    phase: "terminal_success",
    color: "#22C55E",
    picRole: "—",
  },
  {
    id: 9,
    label: "CAF Rejected",
    shortLabel: "Reject",
    phase: "terminal_failure",
    color: "#EF4444",
    picRole: "—",
  },
  {
    id: 10,
    label: "CAF Not Confirmed",
    shortLabel: "Not Conf",
    phase: "terminal_failure",
    color: "#A855F7",
    picRole: "—",
  },
] as const

export const CAF_STATUS_BY_ID = new Map(
  CAF_STATUS_DEFINITIONS.map((definition) => [definition.id, definition])
)

const LABEL_TO_PIPELINE_ID = new Map(
  CAF_STATUS_DEFINITIONS.map((definition) => [normalizeCafStatusText(definition.label), definition.id])
)

export function normalizeCafStatusText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
}

/**
 * Map raw `caf_status` label to pipeline slot id (1–10).
 * Legacy / branch-only labels (CAF Basic, PM Scenario, PM Vendor Approval) fold into the nearest workflow step.
 * Returns 0 when the label cannot be mapped.
 */
export function resolveCafStatusId(cafStatus: string | null | undefined): number {
  const normalized = normalizeCafStatusText(cafStatus ?? "")
  if (!normalized) return 0

  const exact = LABEL_TO_PIPELINE_ID.get(normalized)
  if (exact !== undefined) return exact

  if (normalized.includes("not confirmed")) return 10
  if (normalized.includes("reject")) return 9
  if (
    normalized === "fully implemented" ||
    (normalized.includes("fully implemented") && !normalized.includes("waiting"))
  ) {
    return 8
  }
  if (normalized.includes("waiting fully implemented") && normalized.includes("tlp")) return 7
  if (normalized.includes("approve waiting")) return 6
  if (normalized.includes("waiting fully implemented") && normalized.includes("avp")) return 5
  if (normalized.includes("waiting for approval") && normalized.includes("tlp")) return 4
  if (normalized.includes("pm vendor") && normalized.includes("approval")) return 4
  if (normalized.includes("site management") || normalized.includes("site mgmt")) return 3
  if (normalized.includes("caf scenario") || (normalized.includes("scenario") && normalized.includes("pm"))) {
    return 3
  }
  if (normalized.includes("review") && normalized.includes("tlp")) return 2
  if (normalized.includes("caf basic")) return 2
  if (normalized.includes("confirmation") && normalized.includes("staff")) return 1
  if (normalized.includes("resubmit")) return 1

  return 0
}

export type CafStatusCountItem = {
  id: number
  count: number
  definition: CafStatusDefinition
}

export type CafStatusBreakdown = {
  totalCaf: number
  byStatus: CafStatusCountItem[]
  unknown: number
}

export function createEmptyCafStatusBreakdown(): CafStatusBreakdown {
  return {
    totalCaf: 0,
    byStatus: CAF_STATUS_DEFINITIONS.map((definition) => ({
      id: definition.id,
      count: 0,
      definition,
    })),
    unknown: 0,
  }
}

export function computeCafStatusBreakdown(rows: CafFilterableRow[]): CafStatusBreakdown {
  const counts = new Map<number, number>()
  let unknown = 0

  for (const row of rows) {
    const id = resolveCafStatusId(row.caf_status)
    if (id === 0) {
      unknown += 1
      continue
    }
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return {
    totalCaf: rows.length,
    byStatus: CAF_STATUS_DEFINITIONS.map((definition) => ({
      id: definition.id,
      count: counts.get(definition.id) ?? 0,
      definition,
    })),
    unknown,
  }
}

export function getCafStatusShortLabelFromId(statusId: number): string {
  return CAF_STATUS_BY_ID.get(statusId)?.shortLabel ?? "Unknown"
}

export function getCafStatusColorFromId(statusId: number): string {
  return CAF_STATUS_BY_ID.get(statusId)?.color ?? "#64748B"
}

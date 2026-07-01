/** Short display labels for long CAF status strings (UI only). */
import {
  CAF_STATUS_BY_ID,
  resolveCafStatusId,
} from "@/lib/caf-status-registry"

const CAF_STATUS_SHORT_LABELS: Record<string, string> = {
  "Approve Waiting Implementation": "Awaiting Impl.",
  "CAF Rejected": "Rejected",
  "Waiting for Review – TLP": "TLP Review",
  "CAF Not Confirmed": "Not Confirmed",
  "Waiting Fully Implemented - TLP": "TLP Final",
  "Waiting for Confirmation - Site Management": "Site Mgmt",
  "Waiting for Confirmation - Staff": "Staff Confirm",
  "Fully Implemented": "Implemented",
  "Waiting for Approval - TLP": "TLP Approval",
  "Waiting Fully Implemented - AVP": "AVP Pending",
  "Waiting for CAF Scenario – PM Vendor": "PM Scenario",
  "PM Vendor Approval": "PM Approval",
  "CAF Basic": "CAF Basic",
}

export function getCafStatusShortLabel(status: string): string {
  const trimmed = status.trim()
  if (!trimmed) return "Unknown"

  const fromId = CAF_STATUS_BY_ID.get(resolveCafStatusId(trimmed))
  if (fromId) return fromId.shortLabel

  return CAF_STATUS_SHORT_LABELS[trimmed] ?? trimmed
}

/** Consistent status colors across CAF dashboard cards. */
export function getCafStatusColor(status: string): string {
  const fromId = CAF_STATUS_BY_ID.get(resolveCafStatusId(status))
  if (fromId) return fromId.color

  const s = status.toLowerCase()
  if (s.includes("reject")) return "#EF4444"
  if (s.includes("fully implemented") || s.includes("implemented")) return "#22C55E"
  if (s.includes("approve")) return "#3B82F6"
  if (s.includes("waiting")) return "#F59E0B"
  if (s.includes("not confirmed")) return "#A855F7"
  return "#60A5FA"
}

export const CAF_PIPELINE_COLORS = {
  implemented: "#22C55E",
  approved: "#3B82F6",
  inReview: "#F59E0B",
  rejected: "#EF4444",
  notConfirmed: "#A855F7",
  other: "#64748B",
} as const

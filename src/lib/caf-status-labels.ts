/** Short display labels for long CAF status strings (UI only). */
const CAF_STATUS_SHORT_LABELS: Record<string, string> = {
  "Approve Waiting Implementation": "Approved – Awaiting Impl.",
  "CAF Rejected": "Rejected",
  "Waiting for Review – TLP": "Review – TLP",
  "CAF Not Confirmed": "Not Confirmed",
  "Waiting Fully Implemented - TLP": "Awaiting Impl. – TLP",
  "Waiting for Confirmation - Site Management": "Confirm – Site Mgmt",
  "Waiting for Confirmation - Staff": "Confirm – Staff",
  "Fully Implemented": "Fully Implemented",
  "Waiting for Approval - TLP": "Approval – TLP",
  "Waiting Fully Implemented - AVP": "Awaiting Impl. – AVP",
}

export function getCafStatusShortLabel(status: string): string {
  const trimmed = status.trim()
  if (!trimmed) return "Unknown"
  return CAF_STATUS_SHORT_LABELS[trimmed] ?? trimmed
}

/** Consistent status colors across CAF dashboard cards. */
export function getCafStatusColor(status: string): string {
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

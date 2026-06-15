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

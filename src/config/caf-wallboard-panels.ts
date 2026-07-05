/**
 * CAF wallboard panel visibility.
 * Set to `false` to hide a panel and its layout slot (no empty grid cells).
 *
 * Temporarily disabled:
 * - statusAssigneeGrid — per-status PIC breakdown cards
 * - statusVendorFollowup — pending PIC follow-up card redesign
 * - vendorRan / vendorTlp — vendor leaderboard panels
 *
 * Active panels:
 * - picPending — PIC backlog (Staff, TLP review/approval, AVP)
 * - needFollowUp — AF-complete implementation follow-up by TLP vendor
 */
export const CAF_WALLBOARD_PANELS = {
  statusAssigneeGrid: false,
  picPending: true,
  needFollowUp: true,
  statusVendorFollowup: false,
  vendorRan: false,
  vendorTlp: false,
} as const

export function hasCafWallboardSidePanels(): boolean {
  return (
    CAF_WALLBOARD_PANELS.statusVendorFollowup ||
    CAF_WALLBOARD_PANELS.vendorRan ||
    CAF_WALLBOARD_PANELS.vendorTlp
  )
}

export function hasCafWallboardAssigneeGrid(): boolean {
  return CAF_WALLBOARD_PANELS.statusAssigneeGrid
}

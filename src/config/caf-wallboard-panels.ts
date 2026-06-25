/**
 * CAF wallboard panel visibility.
 * Set to `false` to hide a panel and its layout slot (no empty grid cells).
 *
 * Temporarily disabled — pending PIC follow-up card redesign:
 * - statusVendorFollowup
 * - vendorRan
 * - vendorTlp
 */
export const CAF_WALLBOARD_PANELS = {
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

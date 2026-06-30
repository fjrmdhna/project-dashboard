/** Mobile scroll layout when viewport width is at or below this value (matches Hermes / AOP). */
export const DASHBOARD_MOBILE_BREAKPOINT = 768

/** Wallboard design canvas — must match globals.css --wb-base-width/height */
export const CAF_WALLBOARD_BASE_WIDTH = 1920
export const CAF_WALLBOARD_BASE_HEIGHT = 1080

export function shouldUseDashboardScrollLayout(
  width: number,
  breakpoint = DASHBOARD_MOBILE_BREAKPOINT
): boolean {
  return width <= breakpoint
}

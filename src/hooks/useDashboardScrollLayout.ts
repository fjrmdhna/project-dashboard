"use client"

import { useMemo, useSyncExternalStore } from "react"
import { DASHBOARD_MOBILE_BREAKPOINT } from "@/config/caf-dashboard-layout"

function createWidthStore(breakpoint: number) {
  const query = `(max-width: ${breakpoint}px)`

  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {}
    }

    const mql = window.matchMedia(query)
    const handler = () => callback()

    mql.addEventListener("change", handler)
    window.addEventListener("orientationchange", handler)
    window.visualViewport?.addEventListener("resize", handler)

    return () => {
      mql.removeEventListener("change", handler)
      window.removeEventListener("orientationchange", handler)
      window.visualViewport?.removeEventListener("resize", handler)
    }
  }

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return false
    }
    const width = window.visualViewport?.width ?? window.innerWidth
    return width <= breakpoint
  }

  return { subscribe, getSnapshot }
}

/**
 * Scroll layout on narrow viewports (width ≤ breakpoint).
 * Same rule as useIsMobile — used by Hermes, AOP, Commercial ATP, CAF.
 */
export function useDashboardScrollLayout(
  breakpoint: number = DASHBOARD_MOBILE_BREAKPOINT
): boolean {
  const store = useMemo(() => createWidthStore(breakpoint), [breakpoint])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false)
}

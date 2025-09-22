"use client"

import { useMemo, useSyncExternalStore } from "react"

function createMediaQueryStore(breakpoint: number) {
  const query = `(max-width: ${breakpoint}px)`

  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {}
    }

    const mql = window.matchMedia(query)
    const handler = () => callback()

    if (mql.addEventListener) {
      mql.addEventListener("change", handler)
      return () => mql.removeEventListener("change", handler)
    }

    // Safari < 14 fallback
    // @ts-ignore deprecated but safe fallback
    mql.addListener(handler)
    return () => {
      // @ts-ignore deprecated but safe fallback
      mql.removeListener(handler)
    }
  }

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return false
    }

    return window.matchMedia(query).matches
  }

  return { subscribe, getSnapshot }
}

export function useIsMobile(breakpoint: number = 768) {
  const store = useMemo(() => createMediaQueryStore(breakpoint), [breakpoint])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false)
}

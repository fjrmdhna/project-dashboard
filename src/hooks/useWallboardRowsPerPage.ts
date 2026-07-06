"use client"

import { useLayoutEffect, useState, type RefObject } from "react"

const ROW_HEIGHT_PX = 14
const ROW_GAP_PX = 1
/** Header + vendor label + pager reserve per status section (wallboard). */
const SECTION_CHROME_PX = 34
const MIN_ROWS = 1
const MAX_ROWS = 8

export function useWallboardRowsPerPage(
  containerRef: RefObject<HTMLElement | null>,
  sectionCount: number,
  enabled: boolean
): number {
  const [rows, setRows] = useState(2)

  useLayoutEffect(() => {
    if (!enabled || sectionCount <= 0) return

    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const height = el.clientHeight
      if (height <= 0) return

      const sectionHeight = height / sectionCount
      const listBudget = sectionHeight - SECTION_CHROME_PX
      const rowUnit = ROW_HEIGHT_PX + ROW_GAP_PX
      const fit = Math.floor((listBudget + ROW_GAP_PX) / rowUnit)

      setRows(Math.max(MIN_ROWS, Math.min(MAX_ROWS, fit)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, enabled, sectionCount])

  return rows
}

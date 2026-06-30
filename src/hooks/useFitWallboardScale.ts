"use client"

import { type RefObject, useEffect } from "react"
import {
  CAF_WALLBOARD_BASE_HEIGHT,
  CAF_WALLBOARD_BASE_WIDTH,
} from "@/config/caf-dashboard-layout"

function debounce<T extends (...args: never[]) => void>(fn: T, wait = 100) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

function readViewportSize(): { width: number; height: number } {
  const viewport = window.visualViewport
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  }
}

/**
 * Fit a fixed 1920×1080 wallboard canvas to the current viewport.
 * Sets `--wb-scale` on the canvas element (see globals.css `.wallboard-scale`).
 */
export function useFitWallboardScale(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return

    const applyScale = () => {
      const canvas = containerRef.current
      if (!canvas) return

      const { width: viewportWidth, height: viewportHeight } = readViewportSize()
      const scaleX = viewportWidth / CAF_WALLBOARD_BASE_WIDTH
      const scaleY = viewportHeight / CAF_WALLBOARD_BASE_HEIGHT
      const scale = Math.min(scaleX, scaleY)
      const clamped = Math.max(0.35, Math.min(scale, 1))
      const precise = Math.round(clamped * 1000) / 1000

      canvas.style.setProperty("--wb-scale", String(precise))
    }

    const onResize = debounce(applyScale, 100)
    const onOrientationChange = debounce(applyScale, 200)

    applyScale()
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onOrientationChange)
    window.visualViewport?.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onOrientationChange)
      window.visualViewport?.removeEventListener("resize", onResize)
      containerRef.current?.style.removeProperty("--wb-scale")
    }
  }, [containerRef, enabled])
}

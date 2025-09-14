"use client"

import { useState, useEffect } from 'react'

interface ViewportInfo {
  width: number
  height: number
  devicePixelRatio: number
  aspectRatio: number
  isHighDPI: boolean
  isRetina: boolean
  screenWidth: number
  screenHeight: number
  availableWidth: number
  availableHeight: number
}

export function useViewportDetection() {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    width: 0,
    height: 0,
    devicePixelRatio: 1,
    aspectRatio: 16/9,
    isHighDPI: false,
    isRetina: false,
    screenWidth: 0,
    screenHeight: 0,
    availableWidth: 0,
    availableHeight: 0
  })

  useEffect(() => {
    const updateViewportInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const devicePixelRatio = window.devicePixelRatio || 1
      const aspectRatio = width / height
      
      // Get actual screen dimensions
      const screenWidth = window.screen.width
      const screenHeight = window.screen.height
      
      // Calculate available dimensions (excluding browser UI)
      const availableWidth = window.screen.availWidth
      const availableHeight = window.screen.availHeight
      
      // Detect high DPI and retina displays
      const isHighDPI = devicePixelRatio > 1
      const isRetina = devicePixelRatio >= 2

      setViewportInfo({
        width,
        height,
        devicePixelRatio,
        aspectRatio,
        isHighDPI,
        isRetina,
        screenWidth,
        screenHeight,
        availableWidth,
        availableHeight
      })
    }

    // Initial update
    updateViewportInfo()

    // Listen for resize events
    window.addEventListener('resize', updateViewportInfo)
    window.addEventListener('orientationchange', updateViewportInfo)

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateViewportInfo)
      window.removeEventListener('orientationchange', updateViewportInfo)
    }
  }, [])

  return viewportInfo
}


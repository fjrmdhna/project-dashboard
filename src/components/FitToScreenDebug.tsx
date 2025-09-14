"use client"

import { useState, useEffect } from "react"
import { useViewportDetection } from "@/hooks/useViewportDetection"

interface FitToScreenInfo {
  viewport: { width: number; height: number }
  aspectRatio: number
  devicePixelRatio: number
  currentScale: string
  fitToScreenMode: string
  isUltraWide: boolean
  isPortrait: boolean
  isMobile: boolean
  isHighDPI: boolean
  expectedScale: number
  actualScale: number
  scaleDifference: number
  fitToScreenStatus: string
}

export function FitToScreenDebug() {
  const viewportInfo = useViewportDetection()
  const [debugInfo, setDebugInfo] = useState<FitToScreenInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    const updateDebugInfo = () => {
      if (typeof window === 'undefined') return

      const { width, height, devicePixelRatio, aspectRatio } = viewportInfo
      
      // Get current scale from CSS variable
      const wrapperEl = document.getElementById('wb-wrapper')
      const currentScale = typeof document !== 'undefined' 
        ? (wrapperEl ? getComputedStyle(wrapperEl).getPropertyValue('--wb-scale') || 
                      getComputedStyle(wrapperEl).getPropertyValue('--viewport-scale') : '') ||
          getComputedStyle(document.documentElement).getPropertyValue('--viewport-scale') || 
          document.documentElement.style.getPropertyValue('--viewport-scale') || '1'
        : '1'
      
      // Determine fit-to-screen mode
      let fitToScreenMode = 'standard'
      if (width < 768 || height < 600) {
        fitToScreenMode = 'small-screen-minimum'
      } else if (aspectRatio > 2.5) {
        fitToScreenMode = 'ultra-wide-smart-crop'
      } else if (aspectRatio < 1.0) {
        fitToScreenMode = 'portrait-conservative'
      } else if (aspectRatio > 1.8 && aspectRatio < 2.0) {
        fitToScreenMode = 'widescreen-optimal'
      }

      // Calculate expected scale
      const baseWidth = 1920
      const baseHeight = 1080
      const scaleX = width / baseWidth
      const scaleY = height / baseHeight
      const expectedScale = Math.min(scaleX, scaleY)

      // Get actual scale
      const actualScale = parseFloat(currentScale)

      // Calculate scale difference
      const scaleDifference = Math.abs(actualScale - expectedScale)

      // Determine fit-to-screen status
      let fitToScreenStatus = 'optimal'
      if (scaleDifference > 0.1) {
        fitToScreenStatus = 'needs-adjustment'
      } else if (scaleDifference > 0.05) {
        fitToScreenStatus = 'minor-adjustment'
      }

      setDebugInfo({
        viewport: { width, height },
        aspectRatio,
        devicePixelRatio,
        currentScale,
        fitToScreenMode,
        isUltraWide: aspectRatio > 2.0,
        isPortrait: aspectRatio < 1.0,
        isMobile: width < 768 || height < 600,
        isHighDPI: devicePixelRatio > 1.5,
        expectedScale,
        actualScale,
        scaleDifference,
        fitToScreenStatus
      })
    }

    updateDebugInfo()
    
    const handleResize = () => updateDebugInfo()
    window.addEventListener('resize', handleResize)
    
    // Update periodically to catch changes
    const interval = setInterval(updateDebugInfo, 200)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(interval)
    }
  }, [viewportInfo])

  // Toggle visibility with Ctrl+Shift+F
  useEffect(() => {
    if (!isClient) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault() // Prevent any default browser behavior
        setIsVisible(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isClient])

  if (process.env.NODE_ENV === 'production') {
    return null // Don't show in production
  }

  if (!isClient || !debugInfo || !isVisible) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'text-green-400'
      case 'minor-adjustment': return 'text-yellow-400'
      case 'needs-adjustment': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'small-screen-minimum': return 'text-orange-400'
      case 'ultra-wide-smart-crop': return 'text-purple-400'
      case 'portrait-conservative': return 'text-blue-400'
      case 'widescreen-optimal': return 'text-green-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/90 text-white p-4 rounded-lg font-mono text-xs max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-blue-400">Fit-to-Screen Debug</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-red-400 hover:text-red-300"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        {/* Viewport Info */}
        <div className="text-cyan-400 font-semibold">Viewport</div>
        <div>Size: {debugInfo.viewport.width} × {debugInfo.viewport.height}</div>
        <div>Aspect Ratio: {debugInfo.aspectRatio.toFixed(3)}</div>
        <div>Device Pixel Ratio: {debugInfo.devicePixelRatio}</div>
        
        {/* Device Type */}
        <div className="text-cyan-400 font-semibold mt-2">Device Type</div>
        <div className="flex flex-wrap gap-1">
          {debugInfo.isUltraWide && <span className="bg-purple-500/20 text-purple-300 px-1 rounded">Ultra-wide</span>}
          {debugInfo.isPortrait && <span className="bg-blue-500/20 text-blue-300 px-1 rounded">Portrait</span>}
          {debugInfo.isMobile && <span className="bg-orange-500/20 text-orange-300 px-1 rounded">Mobile</span>}
          {debugInfo.isHighDPI && <span className="bg-green-500/20 text-green-300 px-1 rounded">High DPI</span>}
        </div>
        
        {/* Fit-to-Screen Mode */}
        <div className="text-cyan-400 font-semibold mt-2">Fit-to-Screen Mode</div>
        <div className={getModeColor(debugInfo.fitToScreenMode)}>
          {debugInfo.fitToScreenMode}
        </div>
        
        {/* Scaling Info */}
        <div className="text-cyan-400 font-semibold mt-2">Scaling</div>
        <div>Current Scale: {debugInfo.currentScale}</div>
        <div>Expected Scale: {debugInfo.expectedScale.toFixed(3)}</div>
        <div>Actual Scale: {debugInfo.actualScale.toFixed(3)}</div>
        <div>Difference: {debugInfo.scaleDifference.toFixed(3)}</div>
        
        {/* Status */}
        <div className="text-cyan-400 font-semibold mt-2">Status</div>
        <div className={getStatusColor(debugInfo.fitToScreenStatus)}>
          {debugInfo.fitToScreenStatus}
        </div>
        
        {/* Scale Calculation */}
        <div className="text-cyan-400 font-semibold mt-2">Scale Calculation</div>
        <div>Scale X: {(debugInfo.viewport.width / 1920).toFixed(3)}</div>
        <div>Scale Y: {(debugInfo.viewport.height / 1080).toFixed(3)}</div>
        <div>Min Scale: {Math.min(debugInfo.viewport.width / 1920, debugInfo.viewport.height / 1080).toFixed(3)}</div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          Press <kbd className="bg-gray-700 px-1 rounded">Ctrl+Shift+F</kbd> to toggle
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Base: 1920×1080 (16:9)
        </div>
      </div>
    </div>
  )
}

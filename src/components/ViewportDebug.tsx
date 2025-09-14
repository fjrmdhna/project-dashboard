"use client"

import { useState, useEffect } from "react"
import { useViewportDetection } from "@/hooks/useViewportDetection"

export function ViewportDebug() {
  const viewportInfo = useViewportDetection()
  const [currentScale, setCurrentScale] = useState('1')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Get current scale from CSS variable
    const updateScale = () => {
      if (typeof document !== 'undefined') {
        const scale = document.documentElement.style.getPropertyValue('--viewport-scale') || '1'
        setCurrentScale(scale)
      }
    }

    // Update scale immediately
    updateScale()

    // Update scale on resize
    const handleResize = () => {
      updateScale()
    }

    window.addEventListener('resize', handleResize)
    
    // Update scale periodically to catch changes
    const interval = setInterval(updateScale, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(interval)
    }
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return null // Don't show in production
  }

  if (!isClient) {
    return null // Don't render on server
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="font-bold mb-2">Viewport Debug Info</div>
      <div>Viewport: {viewportInfo.width} × {viewportInfo.height}</div>
      <div>Aspect Ratio: {viewportInfo.aspectRatio.toFixed(3)}</div>
      <div>Device Pixel Ratio: {viewportInfo.devicePixelRatio}</div>
      <div>Screen: {viewportInfo.screenWidth} × {viewportInfo.screenHeight}</div>
      <div>Available: {viewportInfo.availableWidth} × {viewportInfo.availableHeight}</div>
      <div>High DPI: {viewportInfo.isHighDPI ? 'Yes' : 'No'}</div>
      <div>Retina: {viewportInfo.isRetina ? 'Yes' : 'No'}</div>
      <div className="mt-2 text-yellow-300">
        Expected 16:9 Width: {Math.round(viewportInfo.height * (16/9))}px
      </div>
      <div className="text-yellow-300">
        Current Scale: {currentScale}
      </div>
      <div className="text-yellow-300">
        Ultra-wide: {viewportInfo.aspectRatio > 2.0 ? 'Yes' : 'No'}
      </div>
      <div className="text-green-300 mt-1">
        Fit-to-Screen: Enabled
      </div>
    </div>
  )
}

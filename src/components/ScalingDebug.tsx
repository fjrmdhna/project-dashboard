"use client"

import { useEffect, useState } from 'react'

interface ScalingInfo {
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  calculatedScale: number
  cssScale: string
  browserZoom: number
}

export function ScalingDebug() {
  const [scalingInfo, setScalingInfo] = useState<ScalingInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateScalingInfo = () => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const devicePixelRatio = window.devicePixelRatio || 1
      
      // Get CSS scale from computed styles
      const rootElement = document.documentElement
      const computedStyle = getComputedStyle(rootElement)
      const cssScale = computedStyle.getPropertyValue('--viewport-scale') || '1'
      
      // Calculate browser zoom level
      const browserZoom = Math.round((window.outerWidth / window.innerWidth) * 100) / 100
      
      // Calculate our scale - now consistent with base dimensions
      const targetWidth = 1920
      const targetHeight = 1080
      const scaleX = viewportWidth / targetWidth
      const scaleY = viewportHeight / targetHeight
      const calculatedScale = Math.min(scaleX, scaleY)
      
      setScalingInfo({
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        calculatedScale,
        cssScale,
        browserZoom
      })
    }

    updateScalingInfo()
    
    const handleResize = () => updateScalingInfo()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Toggle visibility with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault() // Prevent any default browser behavior
        setIsVisible(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isVisible || !scalingInfo) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg font-mono text-xs max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Scaling Debug</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-red-400 hover:text-red-300"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        <div>Viewport: {scalingInfo.viewportWidth} × {scalingInfo.viewportHeight}</div>
        <div>Device Pixel Ratio: {scalingInfo.devicePixelRatio}</div>
        <div>Browser Zoom: {scalingInfo.browserZoom}x</div>
        <div>Calculated Scale: {scalingInfo.calculatedScale.toFixed(3)}</div>
        <div>CSS Scale: {scalingInfo.cssScale}</div>
        <div>Target: 1920 × 1080</div>
        <div className="text-yellow-300">
          Aspect Ratio: {(scalingInfo.viewportWidth / scalingInfo.viewportHeight).toFixed(3)}
        </div>
        <div className="text-yellow-300">
          Scale X: {(scalingInfo.viewportWidth / 1920).toFixed(3)}
        </div>
        <div className="text-yellow-300">
          Scale Y: {(scalingInfo.viewportHeight / 1080).toFixed(3)}
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          Press Ctrl+Shift+D to toggle
        </div>
      </div>
    </div>
  )
}

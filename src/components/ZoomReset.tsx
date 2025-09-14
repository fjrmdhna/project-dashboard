"use client"

import { useEffect } from 'react'

export function ZoomReset() {
  useEffect(() => {
    // Function to reset zoom level
    const resetZoom = () => {
      // Reset zoom to 100% by setting viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
      }
      
      // Force reflow
      document.body.style.zoom = '1'
      setTimeout(() => {
        document.body.style.zoom = ''
      }, 100)
    }

    // Reset zoom on load
    resetZoom()
    
    // Reset zoom when page becomes visible (handles tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetZoom()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Reset zoom on focus (handles window focus)
    const handleFocus = () => {
      resetZoom()
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return null
}

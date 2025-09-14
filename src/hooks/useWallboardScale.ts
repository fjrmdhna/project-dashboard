import { RefObject, useEffect } from 'react'

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 100) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function useWallboardScale(containerRef?: RefObject<HTMLElement>) {
  useEffect(() => {
    const applyScale = () => {
      const target = containerRef?.current ?? document.documentElement
      
      // Get actual viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Get device pixel ratio for more accurate scaling
      const devicePixelRatio = window.devicePixelRatio || 1
      
      // 16:9 ratio base dimensions - optimized for perfect fit
      const baseWidth = 1400
      const baseHeight = 787
      const aspectRatio = 16 / 9
      
      // Calculate viewport aspect ratio
      const viewportAspectRatio = viewportWidth / viewportHeight
      
      // Determine scaling to fill entire screen
      let scale: number
      if (viewportAspectRatio > aspectRatio) {
        // Viewport is wider than 16:9, fill height
        scale = viewportHeight / baseHeight
      } else {
        // Viewport is narrower than 16:9, fill width
        scale = viewportWidth / baseWidth
      }
      
      // Use max to fill entire screen (no capping)
      scale = Math.max(scale, 1)
      
      // Apply scale with precision
      const preciseScale = Math.round(scale * 1000) / 1000
      target.style.setProperty('--wb-scale', String(preciseScale))
      
      // Also set CSS custom properties for debugging
      target.style.setProperty('--viewport-width', `${viewportWidth}px`)
      target.style.setProperty('--viewport-height', `${viewportHeight}px`)
      target.style.setProperty('--viewport-aspect-ratio', String(viewportAspectRatio))
      target.style.setProperty('--device-pixel-ratio', String(devicePixelRatio))
      target.style.setProperty('--calculated-scale', String(preciseScale))
    }

    const onResize = debounce(applyScale, 100)
    const onOrientationChange = debounce(applyScale, 200)
    
    // Initial scale
    applyScale()
    
    // Listen for resize and orientation changes
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientationChange)
    
    // Also listen for zoom changes (if supported)
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', onResize)
    }
    
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientationChange)
      if ('visualViewport' in window) {
        window.visualViewport?.removeEventListener('resize', onResize)
      }
    }
  }, [containerRef])
} 
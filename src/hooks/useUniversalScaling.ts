"use client"

import { useEffect, RefObject } from 'react'
import { useViewportDetection } from './useViewportDetection'

interface ScalingConfig {
  baseWidth: number
  baseHeight: number
  targetAspectRatio: number
  minScale: number
  maxScale: number
  forceConsistentScaling: boolean
}

const DEFAULT_CONFIG: ScalingConfig = {
  baseWidth: 1920,
  baseHeight: 1080,
  targetAspectRatio: 16/9,
  minScale: 0.4,  // Increased minimum scale for better usability
  maxScale: 3.0,  // Allow larger scaling for ultra-wide
  forceConsistentScaling: true
}

export function useUniversalScaling(
  containerRef?: RefObject<HTMLElement | null>,
  config: Partial<ScalingConfig> = {}
) {
  const viewportInfo = useViewportDetection()
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  useEffect(() => {
    const applyViewportScaling = () => {
      console.log('🚀 useUniversalScaling Hook Executed:', {
        containerRef: containerRef?.current,
        viewportInfo,
        timestamp: new Date().toISOString()
      })
      
      const target = containerRef?.current ?? document.documentElement
      
      if (!target) {
        console.error('❌ No target element found!', { containerRef: containerRef?.current })
        return
      }

      const {
        width: viewportWidth,
        height: viewportHeight,
        devicePixelRatio,
        aspectRatio: viewportAspectRatio
      } = viewportInfo

      if (viewportWidth === 0 || viewportHeight === 0) {
        console.warn('⚠️ Invalid viewport dimensions:', { viewportWidth, viewportHeight })
        return
      }

      // Calculate viewport-based scale factor for fit-to-screen
      // CORRECTED: scale = min(viewportWidth/1920, viewportHeight/1080)
      const scaleX = viewportWidth / finalConfig.baseWidth
      const scaleY = viewportHeight / finalConfig.baseHeight
      let scale = Math.min(scaleX, scaleY)
      
      // Debug log for scale calculation
      console.log('Scale Calculation Debug:', {
        viewportWidth,
        viewportHeight,
        baseWidth: finalConfig.baseWidth,
        baseHeight: finalConfig.baseHeight,
        scaleX: scaleX.toFixed(3),
        scaleY: scaleY.toFixed(3),
        minScale: Math.min(scaleX, scaleY).toFixed(3)
      })

      // Fit-to-screen optimization for different device types
      if (viewportWidth < 768 || viewportHeight < 600) {
        // Small screens (mobile, small laptops) - Minimum usability
        // Ensure dashboard remains usable with better scaling
        scale = Math.max(scale, 0.5) // Increased from 0.3 to 0.5
      } else if (viewportAspectRatio > 2.5) {
        // Ultra-wide screens (32:9, 21:9, etc.) - Smart cropping
        // Allow larger scaling to utilize more screen space
        scale = Math.min(scale * 1.15, scaleX)
      } else if (viewportAspectRatio < 1.0) {
        // Portrait orientation - Conservative fit-to-screen
        // Ensure dashboard fits within viewport
        scale = Math.min(scale * 0.95, scaleY)
      } else if (viewportAspectRatio > 1.8 && viewportAspectRatio < 2.0) {
        // Standard widescreen (16:9, 16:10) - Optimal fit
        // Use standard scaling
        scale = Math.min(scaleX, scaleY)
      }

      // Apply scale limits
      scale = Math.max(finalConfig.minScale, Math.min(scale, finalConfig.maxScale))

      // Skip DPI compensation for fit-to-screen mode
      // DPI compensation breaks the fit-to-screen behavior
      // We want visual fit-to-screen, not pixel-perfect scaling
      // if (devicePixelRatio > 1) {
      //   scale = scale / Math.sqrt(devicePixelRatio)
      // }

      // Round to prevent subpixel rendering issues
      const preciseScale = Math.round(scale * 1000) / 1000
      
      // Manual scale test - force scale to 0.5 for testing
      const testScale = 0.5
      console.log('🧪 Manual Scale Test:', {
        calculatedScale: preciseScale,
        testScale: testScale,
        usingTestScale: true
      })

      // Apply viewport scaling to target (usually documentElement)
      // Use test scale for all CSS variables
      target.style.setProperty('--viewport-scale', String(testScale))
      target.style.setProperty('--viewport-width', `${viewportWidth}px`)
      target.style.setProperty('--viewport-height', `${viewportHeight}px`)
      target.style.setProperty('--device-pixel-ratio', String(devicePixelRatio))
      target.style.setProperty('--viewport-aspect-ratio', String(viewportAspectRatio))
      target.style.setProperty('--calculated-scale', String(preciseScale))

      // Apply scale to canvas element for transform
      const canvasEl = containerRef?.current || document.getElementById('wb-canvas')
      if (canvasEl) {
        // Use test scale for manual testing
        const finalScale = testScale // Use test scale instead of preciseScale
        
        canvasEl.style.setProperty('--wb-scale', String(finalScale))
        canvasEl.style.setProperty('--viewport-scale', String(finalScale))
        // Apply transform directly to canvas
        canvasEl.style.transform = `scale(${finalScale})`
        canvasEl.style.transformOrigin = 'top left'
        
        // Debug log for canvas element
        console.log('🎨 Canvas Element Found:', {
          elementId: canvasEl.id,
          elementTag: canvasEl.tagName,
          hasRef: !!containerRef?.current,
          refMatches: containerRef?.current === canvasEl
        })
      } else {
        console.error('❌ Canvas element not found!', {
          containerRef: containerRef?.current,
          getElementById: document.getElementById('wb-canvas')
        })
      }

      // Also apply to wrapper element for debug console
      const wrapperEl = document.getElementById('wb-wrapper')
      if (wrapperEl) {
        wrapperEl.style.setProperty('--wb-scale', String(testScale))
        wrapperEl.style.setProperty('--viewport-scale', String(testScale))
      }

      // Debug info with enhanced logging
      console.log('🎯 Fit-to-Screen Scaling Applied:', {
        viewport: `${viewportWidth}x${viewportHeight}`,
        aspectRatio: viewportAspectRatio.toFixed(3),
        devicePixelRatio,
        scaleX: scaleX.toFixed(3),
        scaleY: scaleY.toFixed(3),
        baseScale: Math.min(scaleX, scaleY).toFixed(3),
        fitToScreenMode: (viewportWidth < 768 || viewportHeight < 600) ? 'small-screen-minimum' :
                        viewportAspectRatio > 2.5 ? 'ultra-wide-smart-crop' : 
                        viewportAspectRatio < 1.0 ? 'portrait-conservative' : 
                        viewportAspectRatio > 1.8 && viewportAspectRatio < 2.0 ? 'widescreen-optimal' : 'standard',
        calculatedScale: preciseScale,
        testScale: testScale,
        finalScale: testScale, // Using test scale
        baseDimensions: `${finalConfig.baseWidth}x${finalConfig.baseHeight}`,
        fitToScreen: 'enabled',
        dpiCompensation: 'disabled', // DPI compensation disabled for fit-to-screen
        canvasTransform: `scale(${testScale})`,
        canvasPosition: 'top-left',
        debugOutlines: 'enabled'
      })
      
      // Additional debug for canvas element
      if (canvasEl) {
        console.log('🎨 Canvas Element Debug:', {
          elementId: 'wb-canvas',
          computedTransform: getComputedStyle(canvasEl).transform,
          computedScale: getComputedStyle(canvasEl).getPropertyValue('--wb-scale'),
          computedViewportScale: getComputedStyle(canvasEl).getPropertyValue('--viewport-scale'),
          position: getComputedStyle(canvasEl).position,
          top: getComputedStyle(canvasEl).top,
          left: getComputedStyle(canvasEl).left,
          transformOrigin: getComputedStyle(canvasEl).transformOrigin,
          appliedTestScale: testScale,
          expectedTransform: `scale(${testScale})`
        })
      }
    }

    // Apply scaling when viewport info changes
    if (viewportInfo.width > 0 && viewportInfo.height > 0) {
      applyViewportScaling()
    }
  }, [viewportInfo, containerRef, finalConfig])

  return {
    viewportInfo,
    config: finalConfig
  }
}

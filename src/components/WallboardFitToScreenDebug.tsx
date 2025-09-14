"use client"

import { useState, useEffect } from "react"

interface DebugInfo {
  // 0) Sanity: target behavior
  canvasAspectRatio: number
  wrapperFillsViewport: boolean
  scaleFormula: {
    viewportW: number
    viewportH: number
    baseW: number
    baseH: number
    scaleX: number
    scaleY: number
    finalScale: number
  }
  
  // 1) Meta + viewport correctness
  metaViewport: {
    exists: boolean
    content: string
    width: string
    initialScale: string
    viewportFit: string
  }
  globalZoom: {
    htmlZoom: string
    bodyZoom: string
    hasGlobalZoom: boolean
  }
  
  // 2) Wrapper must truly be the viewport
  wrapper: {
    id: string
    position: string
    inset: string
    overflow: string
    background: string
    clientWidth: number
    clientHeight: number
    offsetWidth: number
    offsetHeight: number
    hasParentTransform: boolean
    isTopMost: boolean
  }
  
  // 3) Canvas must not be auto-centered by layout
  canvas: {
    id: string
    width: string
    height: string
    transform: string
    transformOrigin: string
    position: string
    left: string
    top: string
    isCentered: boolean
    hasCenteringClasses: boolean
  }
  
  // 4) Scale formula verification
  scaleCalculation: {
    correctFormula: boolean
    invertedFormula: boolean
    clampedScale: boolean
    expectedScale: number
    actualScale: number
    difference: number
  }
  
  // 5) Hook implementation
  cssVariable: {
    variableName: string
    value: string
    appliedTo: string
    exists: boolean
  }
  
  // 6) Visual debug
  visualDebug: {
    wrapperOutline: boolean
    canvasOutline: boolean
    computedTransform: string
  }
  
  // 7) Chart & children sizing
  charts: {
    responsiveContainer: boolean
    fixedHeights: boolean
    minHeightZero: boolean
  }
  
  // 8) Grid rows & columns
  grid: {
    display: string
    gridTemplateColumns: string
    gridTemplateRows: string
    gap: string
    boxSizing: string
  }
  
  // 9) DPI / Device Pixel Ratio
  dpi: {
    devicePixelRatio: number
    windowInnerWidth: number
    windowInnerHeight: number
    wrapperClientWidth: number
    wrapperClientHeight: number
    usingCorrectDimensions: boolean
  }
  
  // 10) Common gotchas
  gotchas: {
    ancestorTransform: boolean
    scaleOnWrongElement: boolean
    wrapperNotFillingViewport: boolean
    globalCentering: boolean
  }
  
  // 11) Expected vs Got
  expectedVsGot: {
    viewport: string
    expectedScale: number
    actualScale: number
    isCorrect: boolean
    issues: string[]
  }
}

export function WallboardFitToScreenDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    const updateDebugInfo = () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return

      // 0) Sanity: target behavior
      const canvasAspectRatio = 1920 / 1080
      const wrapperEl = document.getElementById('wb-wrapper') || document.querySelector('.viewport-wrapper')
      const canvasEl = document.getElementById('wb-canvas') || document.querySelector('.wallboard-scale')
      
      // 1) Meta + viewport correctness
      const metaViewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
      const htmlStyle = getComputedStyle(document.documentElement)
      const bodyStyle = getComputedStyle(document.body)
      
      // 2) Wrapper must truly be the viewport
      const wrapper = wrapperEl ? {
        id: wrapperEl.id || 'viewport-wrapper',
        position: getComputedStyle(wrapperEl).position,
        inset: getComputedStyle(wrapperEl).inset,
        overflow: getComputedStyle(wrapperEl).overflow,
        background: getComputedStyle(wrapperEl).backgroundColor,
        clientWidth: wrapperEl.clientWidth,
        clientHeight: wrapperEl.clientHeight,
        offsetWidth: wrapperEl.offsetWidth,
        offsetHeight: wrapperEl.offsetHeight,
        hasParentTransform: wrapperEl.parentElement ? 
          getComputedStyle(wrapperEl.parentElement).transform !== 'none' : false,
        isTopMost: wrapperEl.parentElement === document.body
      } : null
      
      // 3) Canvas must not be auto-centered by layout
      const canvas = canvasEl ? {
        id: canvasEl.id || 'wallboard-scale',
        width: getComputedStyle(canvasEl).width,
        height: getComputedStyle(canvasEl).height,
        transform: getComputedStyle(canvasEl).transform,
        transformOrigin: getComputedStyle(canvasEl).transformOrigin,
        position: getComputedStyle(canvasEl).position,
        left: getComputedStyle(canvasEl).left,
        top: getComputedStyle(canvasEl).top,
        isCentered: getComputedStyle(canvasEl).marginLeft === 'auto' || 
                   getComputedStyle(canvasEl).marginRight === 'auto',
        hasCenteringClasses: canvasEl.className.includes('mx-auto') || 
                            canvasEl.className.includes('text-center')
      } : null
      
      // 4) Scale formula verification
      const BASE_W = 1920
      const BASE_H = 1080
      const viewportW = wrapper?.clientWidth || window.innerWidth
      const viewportH = wrapper?.clientHeight || window.innerHeight
      const scaleX = viewportW / BASE_W
      const scaleY = viewportH / BASE_H
      const expectedScale = Math.min(scaleX, scaleY)
      
      // Get actual scale from CSS variable
      const actualScale = wrapperEl ? 
        parseFloat(getComputedStyle(wrapperEl).getPropertyValue('--wb-scale') || 
                  getComputedStyle(wrapperEl).getPropertyValue('--viewport-scale') || 
                  getComputedStyle(document.documentElement).getPropertyValue('--viewport-scale') || '1') : 1
      
      // 5) Hook implementation
      const cssVariable = {
        variableName: '--wb-scale',
        value: wrapperEl ? getComputedStyle(wrapperEl).getPropertyValue('--wb-scale') || 
                          getComputedStyle(document.documentElement).getPropertyValue('--viewport-scale') : '',
        appliedTo: wrapperEl ? wrapperEl.id || 'viewport-wrapper' : 'none',
        exists: wrapperEl ? getComputedStyle(wrapperEl).getPropertyValue('--wb-scale') !== '' ||
                          getComputedStyle(document.documentElement).getPropertyValue('--viewport-scale') !== '' : false
      }
      
      // 6) Visual debug
      const visualDebug = {
        wrapperOutline: wrapperEl ? getComputedStyle(wrapperEl).outline !== 'none' : false,
        canvasOutline: canvasEl ? getComputedStyle(canvasEl).outline !== 'none' : false,
        computedTransform: canvasEl ? getComputedStyle(canvasEl).transform : 'none'
      }
      
      // 7) Chart & children sizing
      const responsiveContainers = document.querySelectorAll('.recharts-responsive-container')
      const fixedHeights = document.querySelectorAll('[style*="height:"][style*="px"]')
      const minHeightZero = document.querySelectorAll('.min-h-0')
      
      // 8) Grid rows & columns
      const gridEl = canvasEl?.querySelector('.wallboard-grid') || canvasEl
      const grid = gridEl ? {
        display: getComputedStyle(gridEl).display,
        gridTemplateColumns: getComputedStyle(gridEl).gridTemplateColumns,
        gridTemplateRows: getComputedStyle(gridEl).gridTemplateRows,
        gap: getComputedStyle(gridEl).gap,
        boxSizing: getComputedStyle(gridEl).boxSizing
      } : null
      
      // 9) DPI / Device Pixel Ratio
      const dpi = {
        devicePixelRatio: window.devicePixelRatio,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        wrapperClientWidth: wrapper?.clientWidth || 0,
        wrapperClientHeight: wrapper?.clientHeight || 0,
        usingCorrectDimensions: wrapper?.clientWidth === window.innerWidth && 
                               wrapper?.clientHeight === window.innerHeight
      }
      
      // 10) Common gotchas
      const gotchas = {
        ancestorTransform: wrapperEl ? 
          Array.from(wrapperEl.parentElement?.children || []).some(el => 
            getComputedStyle(el).transform !== 'none') : false,
        scaleOnWrongElement: canvasEl ? 
          getComputedStyle(canvasEl).transform === 'none' : false,
        wrapperNotFillingViewport: wrapper ? 
          wrapper.clientWidth !== window.innerWidth || 
          wrapper.clientHeight !== window.innerHeight : false,
        globalCentering: canvasEl ? 
          getComputedStyle(canvasEl.parentElement || document.body).display === 'flex' &&
          getComputedStyle(canvasEl.parentElement || document.body).justifyContent === 'center' : false
      }
      
      // 11) Expected vs Got
      const issues: string[] = []
      if (Math.abs(expectedScale - actualScale) > 0.01) {
        issues.push(`Scale mismatch: expected ${expectedScale.toFixed(3)}, got ${actualScale.toFixed(3)}`)
      }
      if (!cssVariable.exists) {
        issues.push('CSS variable --wb-scale not found')
      }
      if (canvas?.isCentered) {
        issues.push('Canvas is auto-centered (should be top-left)')
      }
      if (gotchas.wrapperNotFillingViewport) {
        issues.push('Wrapper does not fill viewport')
      }
      
      setDebugInfo({
        canvasAspectRatio,
        wrapperFillsViewport: wrapper ? 
          wrapper.clientWidth === window.innerWidth && 
          wrapper.clientHeight === window.innerHeight : false,
        scaleFormula: {
          viewportW,
          viewportH,
          baseW: BASE_W,
          baseH: BASE_H,
          scaleX,
          scaleY,
          finalScale: expectedScale
        },
        metaViewport: {
          exists: !!metaViewport,
          content: metaViewport?.content || '',
          width: metaViewport?.content.match(/width=([^,]+)/)?.[1] || '',
          initialScale: metaViewport?.content.match(/initial-scale=([^,]+)/)?.[1] || '',
          viewportFit: metaViewport?.content.match(/viewport-fit=([^,]+)/)?.[1] || ''
        },
        globalZoom: {
          htmlZoom: htmlStyle.zoom || '1',
          bodyZoom: bodyStyle.zoom || '1',
          hasGlobalZoom: htmlStyle.zoom !== '1' || bodyStyle.zoom !== '1'
        },
        wrapper: wrapper || {
          id: 'not-found',
          position: 'not-found',
          inset: 'not-found',
          overflow: 'not-found',
          background: 'not-found',
          clientWidth: 0,
          clientHeight: 0,
          offsetWidth: 0,
          offsetHeight: 0,
          hasParentTransform: false,
          isTopMost: false
        },
        canvas: canvas || {
          id: 'not-found',
          width: 'not-found',
          height: 'not-found',
          transform: 'not-found',
          transformOrigin: 'not-found',
          position: 'not-found',
          left: 'not-found',
          top: 'not-found',
          isCentered: false,
          hasCenteringClasses: false
        },
        scaleCalculation: {
          correctFormula: Math.abs(expectedScale - actualScale) < 0.01,
          invertedFormula: actualScale > 1 && expectedScale < 1,
          clampedScale: actualScale === 1 && expectedScale < 1,
          expectedScale,
          actualScale,
          difference: Math.abs(expectedScale - actualScale)
        },
        cssVariable,
        visualDebug,
        charts: {
          responsiveContainer: responsiveContainers.length > 0,
          fixedHeights: fixedHeights.length > 0,
          minHeightZero: minHeightZero.length > 0
        },
        grid: grid || {
          display: 'not-found',
          gridTemplateColumns: 'not-found',
          gridTemplateRows: 'not-found',
          gap: 'not-found',
          boxSizing: 'not-found'
        },
        dpi,
        gotchas,
        expectedVsGot: {
          viewport: `${viewportW} × ${viewportH}`,
          expectedScale,
          actualScale,
          isCorrect: issues.length === 0,
          issues
        }
      })
    }

    updateDebugInfo()
    
    const handleResize = () => updateDebugInfo()
    window.addEventListener('resize', handleResize)
    
    // Update periodically to catch changes
    const interval = setInterval(updateDebugInfo, 500)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(interval)
    }
  }, [])

  // Toggle visibility with Ctrl+Shift+Q
  useEffect(() => {
    if (!isClient) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
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

  const getStatusColor = (status: boolean) => status ? 'text-green-400' : 'text-red-400'
  const getStatusIcon = (status: boolean) => status ? '✅' : '❌'

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/95 text-white p-4 rounded-lg font-mono text-xs max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-blue-400">Wallboard Fit-to-Screen Debug</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-red-400 hover:text-red-300"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-3">
        {/* 0) Sanity: target behavior */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">0) Sanity: Target Behavior</div>
          <div>Canvas Aspect Ratio: {debugInfo.canvasAspectRatio.toFixed(3)} (16:9)</div>
          <div className={getStatusColor(debugInfo.wrapperFillsViewport)}>
            {getStatusIcon(debugInfo.wrapperFillsViewport)} Wrapper fills viewport
          </div>
          <div>Scale Formula: min({debugInfo.scaleFormula.viewportW}/{debugInfo.scaleFormula.baseW}, {debugInfo.scaleFormula.viewportH}/{debugInfo.scaleFormula.baseH}) = {debugInfo.scaleFormula.finalScale.toFixed(3)}</div>
        </div>

        {/* 1) Meta + viewport correctness */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">1) Meta + Viewport Correctness</div>
          <div className={getStatusColor(debugInfo.metaViewport.exists)}>
            {getStatusIcon(debugInfo.metaViewport.exists)} Meta viewport exists
          </div>
          <div>Content: {debugInfo.metaViewport.content}</div>
          <div className={getStatusColor(!debugInfo.globalZoom.hasGlobalZoom)}>
            {getStatusIcon(!debugInfo.globalZoom.hasGlobalZoom)} No global CSS zoom
          </div>
        </div>

        {/* 2) Wrapper must truly be the viewport */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">2) Wrapper Must Be Viewport</div>
          <div>ID: {debugInfo.wrapper.id}</div>
          <div>Position: {debugInfo.wrapper.position}</div>
          <div>Inset: {debugInfo.wrapper.inset}</div>
          <div>Overflow: {debugInfo.wrapper.overflow}</div>
          <div>Size: {debugInfo.wrapper.clientWidth} × {debugInfo.wrapper.clientHeight}</div>
          <div className={getStatusColor(debugInfo.wrapper.isTopMost)}>
            {getStatusIcon(debugInfo.wrapper.isTopMost)} Is top-most container
          </div>
          <div className={getStatusColor(!debugInfo.wrapper.hasParentTransform)}>
            {getStatusIcon(!debugInfo.wrapper.hasParentTransform)} No parent transform
          </div>
        </div>

        {/* 3) Canvas must not be auto-centered */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">3) Canvas Not Auto-Centered</div>
          <div>ID: {debugInfo.canvas.id}</div>
          <div>Size: {debugInfo.canvas.width} × {debugInfo.canvas.height}</div>
          <div>Transform: {debugInfo.canvas.transform}</div>
          <div>Transform Origin: {debugInfo.canvas.transformOrigin}</div>
          <div>Position: {debugInfo.canvas.position}</div>
          <div>Left: {debugInfo.canvas.left}, Top: {debugInfo.canvas.top}</div>
          <div className={getStatusColor(!debugInfo.canvas.isCentered)}>
            {getStatusIcon(!debugInfo.canvas.isCentered)} Not auto-centered
          </div>
          <div className={getStatusColor(!debugInfo.canvas.hasCenteringClasses)}>
            {getStatusIcon(!debugInfo.canvas.hasCenteringClasses)} No centering classes
          </div>
        </div>

        {/* 4) Scale formula verification */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">4) Scale Formula Verification</div>
          <div>Scale X: {debugInfo.scaleFormula.scaleX.toFixed(3)}</div>
          <div>Scale Y: {debugInfo.scaleFormula.scaleY.toFixed(3)}</div>
          <div>Expected: {debugInfo.scaleCalculation.expectedScale.toFixed(3)}</div>
          <div>Actual: {debugInfo.scaleCalculation.actualScale.toFixed(3)}</div>
          <div>Difference: {debugInfo.scaleCalculation.difference.toFixed(3)}</div>
          <div className={getStatusColor(debugInfo.scaleCalculation.correctFormula)}>
            {getStatusIcon(debugInfo.scaleCalculation.correctFormula)} Correct formula
          </div>
          <div className={getStatusColor(!debugInfo.scaleCalculation.invertedFormula)}>
            {getStatusIcon(!debugInfo.scaleCalculation.invertedFormula)} Not inverted
          </div>
          <div className={getStatusColor(!debugInfo.scaleCalculation.clampedScale)}>
            {getStatusIcon(!debugInfo.scaleCalculation.clampedScale)} Not clamped to 1
          </div>
        </div>

        {/* 5) Hook implementation */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">5) Hook Implementation</div>
          <div>Variable: {debugInfo.cssVariable.variableName}</div>
          <div>Value: {debugInfo.cssVariable.value}</div>
          <div>Applied to: {debugInfo.cssVariable.appliedTo}</div>
          <div className={getStatusColor(debugInfo.cssVariable.exists)}>
            {getStatusIcon(debugInfo.cssVariable.exists)} CSS variable exists
          </div>
        </div>

        {/* 6) Visual debug */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">6) Visual Debug</div>
          <div>Wrapper Outline: {debugInfo.visualDebug.wrapperOutline ? 'Yes' : 'No'}</div>
          <div>Canvas Outline: {debugInfo.visualDebug.canvasOutline ? 'Yes' : 'No'}</div>
          <div>Computed Transform: {debugInfo.visualDebug.computedTransform}</div>
        </div>

        {/* 7) Chart & children sizing */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">7) Chart & Children Sizing</div>
          <div className={getStatusColor(debugInfo.charts.responsiveContainer)}>
            {getStatusIcon(debugInfo.charts.responsiveContainer)} ResponsiveContainer found
          </div>
          <div className={getStatusColor(!debugInfo.charts.fixedHeights)}>
            {getStatusIcon(!debugInfo.charts.fixedHeights)} No fixed heights
          </div>
          <div className={getStatusColor(debugInfo.charts.minHeightZero)}>
            {getStatusIcon(debugInfo.charts.minHeightZero)} Min-height: 0 found
          </div>
        </div>

        {/* 8) Grid rows & columns */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">8) Grid Rows & Columns</div>
          <div>Display: {debugInfo.grid.display}</div>
          <div>Columns: {debugInfo.grid.gridTemplateColumns}</div>
          <div>Rows: {debugInfo.grid.gridTemplateRows}</div>
          <div>Gap: {debugInfo.grid.gap}</div>
          <div>Box Sizing: {debugInfo.grid.boxSizing}</div>
        </div>

        {/* 9) DPI / Device Pixel Ratio */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">9) DPI / Device Pixel Ratio</div>
          <div>Device Pixel Ratio: {debugInfo.dpi.devicePixelRatio}</div>
          <div>Window: {debugInfo.dpi.windowInnerWidth} × {debugInfo.dpi.windowInnerHeight}</div>
          <div>Wrapper: {debugInfo.dpi.wrapperClientWidth} × {debugInfo.dpi.wrapperClientHeight}</div>
          <div className={getStatusColor(debugInfo.dpi.usingCorrectDimensions)}>
            {getStatusIcon(debugInfo.dpi.usingCorrectDimensions)} Using correct dimensions
          </div>
        </div>

        {/* 10) Common gotchas */}
        <div className="border-b border-gray-600 pb-2">
          <div className="text-cyan-400 font-semibold">10) Common Gotchas</div>
          <div className={getStatusColor(!debugInfo.gotchas.ancestorTransform)}>
            {getStatusIcon(!debugInfo.gotchas.ancestorTransform)} No ancestor transform
          </div>
          <div className={getStatusColor(!debugInfo.gotchas.scaleOnWrongElement)}>
            {getStatusIcon(!debugInfo.gotchas.scaleOnWrongElement)} Scale on correct element
          </div>
          <div className={getStatusColor(!debugInfo.gotchas.wrapperNotFillingViewport)}>
            {getStatusIcon(!debugInfo.gotchas.wrapperNotFillingViewport)} Wrapper fills viewport
          </div>
          <div className={getStatusColor(!debugInfo.gotchas.globalCentering)}>
            {getStatusIcon(!debugInfo.gotchas.globalCentering)} No global centering
          </div>
        </div>

        {/* 11) Expected vs Got */}
        <div>
          <div className="text-cyan-400 font-semibold">11) Expected vs Got</div>
          <div>Viewport: {debugInfo.expectedVsGot.viewport}</div>
          <div>Expected Scale: {debugInfo.expectedVsGot.expectedScale.toFixed(3)}</div>
          <div>Actual Scale: {debugInfo.expectedVsGot.actualScale.toFixed(3)}</div>
          <div className={getStatusColor(debugInfo.expectedVsGot.isCorrect)}>
            {getStatusIcon(debugInfo.expectedVsGot.isCorrect)} Overall Status
          </div>
          {debugInfo.expectedVsGot.issues.length > 0 && (
            <div className="text-red-400 mt-2">
              <div>Issues:</div>
              {debugInfo.expectedVsGot.issues.map((issue, index) => (
                <div key={index}>• {issue}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          Press <kbd className="bg-gray-700 px-1 rounded">Ctrl+Shift+Q</kbd> to toggle
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Based on Wallboard Fit-to-Screen Debug Checklist
        </div>
      </div>
    </div>
  )
}

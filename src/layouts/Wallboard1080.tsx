"use client"

import { ReactNode, useRef, useEffect } from "react"
import { useUniversalScaling } from "@/hooks/useUniversalScaling"

interface GridItemProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

function GridItem({ children, className = "", style = {} }: GridItemProps) {
  return (
    <div 
      style={style}
      className={`wallboard-grid-item ${className}`}
    >
      {children}
    </div>
  )
}

interface Wallboard1080Props {
  header?: ReactNode
  filterBar?: ReactNode
  matrixStats?: ReactNode
  readinessCard?: ReactNode
  activatedCard?: ReactNode
  progressCurve?: ReactNode
  dailyRunrate?: ReactNode
  top5Issue?: ReactNode
  nanoCluster?: ReactNode
  leaderboard?: ReactNode
}

export function Wallboard1080({
  header,
  filterBar,
  matrixStats,
  readinessCard,
  activatedCard,
  progressCurve,
  dailyRunrate,
  top5Issue,
  nanoCluster,
  leaderboard
}: Wallboard1080Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Apply universal scaling for consistent display across all devices
  useUniversalScaling(containerRef, {
    forceConsistentScaling: true, // Use consistent scaling instead of fill
    minScale: 0.4, // Allow smaller scaling for mobile devices
    maxScale: 3.0  // Allow larger scaling for ultra-wide screens
  })

  // Prevent body scroll when wallboard is active
  useEffect(() => {
    // Add class to prevent body scroll
    document.documentElement.classList.add('viewport-active')
    document.body.classList.add('viewport-active')
    
    // Cleanup on unmount
    return () => {
      document.documentElement.classList.remove('viewport-active')
      document.body.classList.remove('viewport-active')
    }
  }, [])

  return (
    <div id="wb-wrapper" className="viewport-wrapper">
      <div id="wb-canvas" ref={containerRef} className="wallboard-scale">
        <div className="wallboard-grid">
          {/* Header - Full width, minimal height */}
          <div className="wallboard-header">
            {header}
          </div>
          
          {/* Main Content Area - CSS Grid Layout */}
          <div className="wallboard-content">
            {/* Column 1: Readiness & Activated (Left) */}
            <div className="wallboard-side-column">
              {/* 5G Readiness - Top half */}
              <GridItem className="wallboard-side-card">
                {readinessCard}
              </GridItem>
              
              {/* 5G Activated - Bottom half */}
              <GridItem className="wallboard-side-card">
                {activatedCard}
              </GridItem>
            </div>
            
            {/* Column 2: Filter, Matrix, Progress, Bottom Row (Middle) */}
            <div className="wallboard-middle-column">
              {/* Filter Bar - Auto height */}
              <GridItem className="wallboard-middle-card">
                {filterBar}
              </GridItem>
              
              {/* Matrix Stats - 1fr */}
              <GridItem className="wallboard-middle-card">
                {matrixStats}
              </GridItem>
              
              {/* Progress Curve - 1fr */}
              <GridItem className="wallboard-middle-card">
                {progressCurve}
              </GridItem>
              
              {/* Bottom Row - Auto height with nested grid */}
              <div className="wallboard-grid-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--wb-grid-gap)' }}>
                {/* Daily Runrate */}
                <GridItem className="wallboard-middle-card">
                  {dailyRunrate}
                </GridItem>
                
                {/* Top 5 Issue */}
                <GridItem className="wallboard-middle-card">
                  {top5Issue}
                </GridItem>
              </div>
            </div>
            
            {/* Column 3: Nano Cluster & Leaderboard (Right) */}
            <div className="wallboard-side-column">
              {/* Nano Cluster - Top half */}
              <GridItem className="wallboard-side-card">
                {nanoCluster}
              </GridItem>
              
              {/* Leaderboard - Bottom half */}
              <GridItem className="wallboard-side-card">
                {leaderboard}
              </GridItem>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
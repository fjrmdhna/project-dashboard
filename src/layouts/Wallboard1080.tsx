"use client"

import { ReactNode } from "react"

interface GridItemProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

function GridItem({ children, className = "", style = {} }: GridItemProps) {
  return (
    <div 
      style={style}
      className={`w-full h-full ${className}`}
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
  dataAlignment?: ReactNode
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
  dataAlignment,
  nanoCluster,
  leaderboard
}: Wallboard1080Props) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0D1221]">
      <div className="wallboard-scale">
        <div className="w-full h-full box-border">
          {/* Header - Full width, minimal height */}
          <div className="w-full" style={{ height: 'var(--wb-header-height)', padding: '0 1.5rem' }}>
            {header}
          </div>
          
          {/* Main Content Area */}
          <div className="w-full px-6 flex" style={{ height: 'var(--wb-content-height)', gap: 'var(--wb-column-gap)' }}>
            {/* Column 1: Readiness & Activated (Left) */}
            <div className="h-full flex flex-col" style={{ width: 'var(--wb-side-column-width)', gap: 'var(--wb-row-gap)' }}>
              {/* 5G Readiness - Top half */}
              <GridItem style={{ height: 'var(--wb-side-card-height)' }}>
                {readinessCard}
              </GridItem>
              
              {/* 5G Activated - Bottom half */}
              <GridItem style={{ height: 'var(--wb-side-card-height)' }}>
                {activatedCard}
              </GridItem>
            </div>
            
            {/* Column 2: Filter, Matrix, Progress, Bottom Row (Middle) */}
            <div className="h-full flex-grow flex flex-col">
              {/* Filter Bar - Thin row */}
              <div style={{ height: 'var(--wb-filter-height)', marginBottom: 'var(--wb-matrix-margin)' }}>
                {filterBar}
              </div>
              
              {/* Matrix Stats - Auto height with no bottom space */}
              <div className="mb-4">
                {matrixStats}
              </div>
              
              {/* Progress Curve - Reduced height */}
              <div style={{ height: 'var(--wb-progress-height)', marginBottom: 'var(--wb-matrix-margin)' }}>
                {progressCurve}
              </div>
              
              {/* Bottom Row - Small cards with reduced height */}
              <div className="flex" style={{ height: 'var(--wb-bottom-cards-height)', gap: 'var(--wb-column-gap)' }}>
                {/* Daily Runrate */}
                <GridItem className="w-1/3">
                  {dailyRunrate}
                </GridItem>
                
                {/* Top 5 Issue */}
                <GridItem className="w-1/3">
                  {top5Issue}
                </GridItem>
                
                {/* Data Alignment */}
                <GridItem className="w-1/3">
                  {dataAlignment}
                </GridItem>
              </div>
            </div>
            
            {/* Column 3: Nano Cluster & Leaderboard (Right) */}
            <div className="h-full flex flex-col" style={{ width: 'var(--wb-side-column-width)', gap: 'var(--wb-row-gap)' }}>
              {/* Nano Cluster - Top half */}
              <GridItem style={{ height: 'var(--wb-side-card-height)' }}>
                {nanoCluster}
              </GridItem>
              
              {/* Leaderboard - Bottom half */}
              <GridItem style={{ height: 'var(--wb-side-card-height)' }}>
                {leaderboard}
              </GridItem>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
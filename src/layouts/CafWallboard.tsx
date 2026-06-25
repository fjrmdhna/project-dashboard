"use client"

import { ReactNode, useEffect } from "react"

interface CafWallboardProps {
  header?: ReactNode
  filterBar?: ReactNode
  matrixStats?: ReactNode
  milestoneAlignment?: ReactNode
  statusFunnel?: ReactNode
  aging?: ReactNode
  dailyRunrate?: ReactNode
  vendorRan?: ReactNode
  vendorTlp?: ReactNode
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`caf-wallboard-panel min-h-0 min-w-0 ${className}`}>{children}</div>
}

export function CafWallboard({
  header,
  filterBar,
  matrixStats,
  milestoneAlignment,
  statusFunnel,
  aging,
  dailyRunrate,
  vendorRan,
  vendorTlp,
}: CafWallboardProps) {
  useEffect(() => {
    document.documentElement.classList.add("viewport-active")
    document.body.classList.add("viewport-active")
    return () => {
      document.documentElement.classList.remove("viewport-active")
      document.body.classList.remove("viewport-active")
    }
  }, [])

  return (
    <div id="wb-wrapper" className="viewport-wrapper">
      <div id="wb-canvas" className="wallboard-scale caf-wallboard-scale">
        <div className="caf-wallboard-grid">
          <header className="caf-wallboard-header">{header}</header>

          <div className="caf-wallboard-body">
            <Panel className="caf-wallboard-filters">{filterBar}</Panel>
            <Panel className="caf-wallboard-matrix">{matrixStats}</Panel>
            <Panel className="caf-wallboard-milestone">{milestoneAlignment}</Panel>
            <Panel className="caf-wallboard-funnel">{statusFunnel}</Panel>
            <Panel className="caf-wallboard-aging">{aging}</Panel>
            <Panel className="caf-wallboard-runrate">{dailyRunrate}</Panel>
            <Panel className="caf-wallboard-vendor-ran">{vendorRan}</Panel>
            <Panel className="caf-wallboard-vendor-tlp">{vendorTlp}</Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
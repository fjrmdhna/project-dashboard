"use client"

import { type ReactNode, useEffect } from "react"
import { hasCafWallboardSidePanels } from "@/config/caf-wallboard-panels"

interface CafWallboardProps {
  header?: ReactNode
  filterBar?: ReactNode
  matrixStats?: ReactNode
  afCompleteStatus?: ReactNode
  statusAssigneeGrid?: ReactNode
  statusVendorFollowup?: ReactNode
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
  afCompleteStatus,
  statusAssigneeGrid,
  statusVendorFollowup,
  dailyRunrate,
  vendorRan,
  vendorTlp,
}: CafWallboardProps) {
  const hasSidePanels = hasCafWallboardSidePanels()

  useEffect(() => {
    document.documentElement.classList.add("viewport-active")
    document.body.classList.add("viewport-active")
    return () => {
      document.documentElement.classList.remove("viewport-active")
      document.body.classList.remove("viewport-active")
    }
  }, [])

  const bodyClass = hasSidePanels
    ? "caf-wallboard-body"
    : "caf-wallboard-body caf-wallboard-body--assignee"

  return (
    <div id="wb-wrapper" className="viewport-wrapper">
      <div id="wb-canvas" className="wallboard-scale">
        <div className="caf-wallboard-grid">
          <header className="caf-wallboard-header">
            <div className="caf-wallboard-header-main">{header}</div>
            {filterBar ? <div className="caf-wallboard-header-filters">{filterBar}</div> : null}
          </header>

          <div className={bodyClass}>
            <Panel className="caf-wallboard-matrix">{matrixStats}</Panel>
            <Panel className="caf-wallboard-status-grid">{statusAssigneeGrid}</Panel>
            {afCompleteStatus ? (
              <Panel className="caf-wallboard-af-complete">{afCompleteStatus}</Panel>
            ) : null}
            {statusVendorFollowup ? (
              <Panel className="caf-wallboard-followup">{statusVendorFollowup}</Panel>
            ) : null}
            <Panel className="caf-wallboard-runrate caf-wallboard-runrate--compact">{dailyRunrate}</Panel>
            {vendorRan ? (
              <Panel className="caf-wallboard-vendor-ran">{vendorRan}</Panel>
            ) : null}
            {vendorTlp ? (
              <Panel className="caf-wallboard-vendor-tlp">{vendorTlp}</Panel>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

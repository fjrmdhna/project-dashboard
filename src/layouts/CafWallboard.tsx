"use client"

import { type ReactNode, useEffect } from "react"
import {
  CAF_WALLBOARD_PANELS,
  hasCafWallboardAssigneeGrid,
  hasCafWallboardSidePanels,
} from "@/config/caf-wallboard-panels"

interface CafWallboardProps {
  header?: ReactNode
  filterBar?: ReactNode
  matrixStats?: ReactNode
  picPending?: ReactNode
  needFollowUp?: ReactNode
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
  picPending,
  needFollowUp,
  statusAssigneeGrid,
  statusVendorFollowup,
  dailyRunrate,
  vendorRan,
  vendorTlp,
}: CafWallboardProps) {
  const hasSidePanels = hasCafWallboardSidePanels()
  const showAssigneeGrid = hasCafWallboardAssigneeGrid() && Boolean(statusAssigneeGrid)

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
    : showAssigneeGrid
      ? "caf-wallboard-body caf-wallboard-body--assignee"
      : "caf-wallboard-body caf-wallboard-body--main"

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
            {showAssigneeGrid ? (
              <Panel className="caf-wallboard-status-grid">{statusAssigneeGrid}</Panel>
            ) : null}
            {CAF_WALLBOARD_PANELS.picPending && picPending ? (
              <Panel className="caf-wallboard-pic-pending">{picPending}</Panel>
            ) : null}
            {CAF_WALLBOARD_PANELS.needFollowUp && needFollowUp ? (
              <Panel className="caf-wallboard-need-followup">{needFollowUp}</Panel>
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

"use client"

import { useMemo } from "react"
import { Clock, AlertTriangle } from "lucide-react"

// Type for row data
interface Row {
  system_key?: string | null
  project_name?: string | null
  po_date?: string | null
  po_number?: string | null
  rfs_af?: string | null
}

export interface AgingPoCardProps {
  rows: Row[]
  isLoading?: boolean
  className?: string
}

interface ProjectAgingData {
  id: string
  projectName: string
  /** Unique system_key count that are aging (not completed + have po_date) */
  agingSystemKeyCount: number
  /** Unique po_number count among aging rows */
  agingUniquePoCount: number
  oldestAgingDays: number
  poNullCount: number
  totalScope: number
  completedScope: number
  completedPct: number
}

// Calculate days between two dates
function calculateAgingDays(poDate: string): number {
  const po = new Date(poDate)
  const now = new Date()
  
  // Reset time to start of day for accurate day calculation
  po.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  
  const diffTime = now.getTime() - po.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays) // Ensure non-negative
}

// Check if date string is valid
function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

// Normalize project name for grouping (lowercase, trimmed)
function normalizeProjectName(name: string): string {
  return name.trim().toLowerCase()
}

// Format project name for display (Title Case)
function formatProjectName(name: string): string {
  return name
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Get color based on aging days threshold
function getAgingColor(days: number): { bg: string; text: string; border: string } {
  if (days === 0) return { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" }
  if (days < 30) return { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" }
  if (days < 60) return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" }
  if (days < 90) return { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" }
  return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" }
}

// Get color based on completion percentage
function getCompletionColor(pct: number): string {
  if (pct >= 100) return "text-green-400"
  if (pct >= 80) return "text-lime-400"
  if (pct >= 60) return "text-yellow-400"
  if (pct >= 40) return "text-orange-400"
  return "text-red-400"
}

// Project item component
interface ProjectItemProps {
  projectName: string
  agingSystemKeyCount: number
  agingUniquePoCount: number
  oldestAgingDays: number
  poNullCount: number
  completedPct: number
  totalScope: number
  completedScope: number
}

function ProjectItem({ projectName, agingSystemKeyCount, agingUniquePoCount, oldestAgingDays, poNullCount, completedPct, totalScope, completedScope }: ProjectItemProps) {
  const agingColor = getAgingColor(oldestAgingDays)

  return (
    <div className={`flex items-center justify-between rounded-md border ${agingColor.border} p-1.5 transition-all hover:bg-white/5 min-w-0`}>
      <div className="flex items-center flex-1 min-w-0">
        <div className={`${agingColor.bg} p-1 rounded-md mr-2 flex-shrink-0`}>
          <Clock className={`h-2.5 w-2.5 ${agingColor.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-semibold text-white truncate" title={projectName}>
            {projectName}
          </div>
          <div className="text-[7px] text-[#B0B7C3]">
            {agingSystemKeyCount} Syskey from {agingUniquePoCount} PO
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        {/* Completion percentage */}
        <div className={`text-[9px] font-bold ${getCompletionColor(completedPct)}`} title={`Completion rate: ${completedScope}/${totalScope} system_key with rfs_af`}>
          {completedPct.toFixed(0)}%
        </div>
        {/* Oldest aging days */}
        <div className={`text-[9px] font-bold ${agingColor.text}`} title="Oldest aging days">
          {oldestAgingDays}d
        </div>
        {/* PO Null count */}
        {poNullCount > 0 && (
          <div className="flex items-center bg-gray-500/20 px-1 py-0.5 rounded" title={`${poNullCount} PO date not set`}>
            <AlertTriangle className="h-2 w-2 text-gray-400 mr-0.5" />
            <span className="text-[7px] text-gray-400">{poNullCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function AgingPoCard({ rows, isLoading = false, className = "" }: AgingPoCardProps) {
  // Calculate aging data per project
  const projectData = useMemo(() => {
    if (isLoading || !rows || rows.length === 0) {
      return []
    }

    // Group data by project
    const projectMap = new Map<string, {
      displayName: string
      agingSystemKeys: Set<string>
      agingPoNumbers: Set<string>
      oldestAgingDays: number
      poNullCount: number
      totalScope: number
      completedScope: number
      systemKeyStatus: Map<string, boolean>
    }>()

    for (const row of rows) {
      const rawProjectName = row.project_name
      if (!rawProjectName || !row.system_key) continue

      const normalizedKey = normalizeProjectName(rawProjectName)
      const displayName = formatProjectName(rawProjectName)

      const data = projectMap.get(normalizedKey) || {
        displayName,
        agingSystemKeys: new Set<string>(),
        agingPoNumbers: new Set<string>(),
        oldestAgingDays: 0,
        poNullCount: 0,
        totalScope: 0,
        completedScope: 0,
        systemKeyStatus: new Map<string, boolean>()
      }

      const hasRfsAf = isValidDate(row.rfs_af)
      const currentStatus = data.systemKeyStatus.get(row.system_key)

      if (currentStatus === undefined) {
        data.systemKeyStatus.set(row.system_key, hasRfsAf)
        data.totalScope++
        if (hasRfsAf) data.completedScope++
      } else {
        if (!currentStatus && hasRfsAf) {
          data.systemKeyStatus.set(row.system_key, true)
          data.completedScope++
        }
      }

      const isCompleted = data.systemKeyStatus.get(row.system_key) ?? false
      if (!isCompleted) {
        const hasPoDate = isValidDate(row.po_date)

        if (!hasPoDate) {
          data.poNullCount++
        } else {
          data.agingSystemKeys.add(row.system_key)
          const poNum = (row.po_number ?? '').toString().trim()
          if (poNum) data.agingPoNumbers.add(poNum)

          const agingDays = calculateAgingDays(row.po_date as string)
          if (agingDays > data.oldestAgingDays) {
            data.oldestAgingDays = agingDays
          }
        }
      }

      projectMap.set(normalizedKey, data)
    }

    const result: ProjectAgingData[] = Array.from(projectMap.entries())
      .map(([normalizedKey, data]) => ({
        id: normalizedKey,
        projectName: data.displayName,
        agingSystemKeyCount: data.agingSystemKeys.size,
        agingUniquePoCount: data.agingPoNumbers.size,
        oldestAgingDays: data.oldestAgingDays,
        poNullCount: data.poNullCount,
        totalScope: data.totalScope,
        completedScope: data.completedScope,
        completedPct: data.totalScope > 0 ? (data.completedScope / data.totalScope) * 100 : 0
      }))
      // Sort by oldest aging days descending (project with oldest PO first)
      .sort((a, b) => b.oldestAgingDays - a.oldestAgingDays)

    return result
  }, [rows, isLoading])

  const totals = useMemo(() => {
    const sums = projectData.reduce(
      (acc, item) => ({
        agingSystemKeyCount: acc.agingSystemKeyCount + item.agingSystemKeyCount,
        agingUniquePoCount: acc.agingUniquePoCount + item.agingUniquePoCount,
        poNullCount: acc.poNullCount + item.poNullCount,
        totalScope: acc.totalScope + item.totalScope,
        completedScope: acc.completedScope + item.completedScope
      }),
      { agingSystemKeyCount: 0, agingUniquePoCount: 0, poNullCount: 0, totalScope: 0, completedScope: 0 }
    )
    return {
      ...sums,
      completedPct: sums.totalScope > 0 ? (sums.completedScope / sums.totalScope) * 100 : 0
    }
  }, [projectData])

  if (isLoading) {
    return (
      <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex items-center justify-center p-1 ${className}`}>
        <div className="animate-pulse text-white/50 text-[9px]">Loading...</div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-orange-500/20 p-0.5 rounded-sm">
            <Clock className="h-2.5 w-2.5 text-orange-400" />
          </div>
          <div className="text-[8px] font-semibold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">
            AGING PO
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Total completion percentage */}
          <div className="bg-green-500/10 px-1.5 py-0.5 rounded-sm flex items-center" title={`Overall completion rate: ${totals.completedScope}/${totals.totalScope} system_key with rfs_af`}>
            <div className={`text-[9px] font-bold ${getCompletionColor(totals.completedPct)}`}>
              {totals.completedPct.toFixed(0)}%
            </div>
          </div>
          {/* Total aging PO count; full detail (Syskey / PO) on hover */}
          <div
            className="bg-orange-500/10 px-1.5 py-0.5 rounded-sm flex items-center cursor-default"
            title={`${totals.agingSystemKeyCount.toLocaleString()} Syskey from ${totals.agingUniquePoCount.toLocaleString()} PO`}
          >
            <div className="text-[7px] text-orange-300 mr-0.5">Aging:</div>
            <div className="text-[9px] font-bold text-white">{totals.agingUniquePoCount.toLocaleString()} PO</div>
          </div>
          {/* Total null POs */}
          {totals.poNullCount > 0 && (
            <div className="bg-gray-500/10 px-1 py-0.5 rounded-sm flex items-center" title="PO date not set">
              <AlertTriangle className="h-2 w-2 text-gray-400 mr-0.5" />
              <div className="text-[9px] font-bold text-gray-400">{totals.poNullCount.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-2 mb-1 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
          <span className="text-[6px] text-white/50">&lt;30d</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
          <span className="text-[6px] text-white/50">30-59d</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
          <span className="text-[6px] text-white/50">60-89d</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
          <span className="text-[6px] text-white/50">≥90d</span>
        </div>
      </div>
      
      {/* Scrollable list of projects */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {projectData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/40 text-[8px] h-full">
            No aging PO data available
          </div>
        ) : (
          <div className="space-y-1">
            {projectData.map((project) => (
              <ProjectItem
                key={project.id}
                projectName={project.projectName}
                agingSystemKeyCount={project.agingSystemKeyCount}
                agingUniquePoCount={project.agingUniquePoCount}
                oldestAgingDays={project.oldestAgingDays}
                poNullCount={project.poNullCount}
                completedPct={project.completedPct}
                totalScope={project.totalScope}
                completedScope={project.completedScope}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AgingPoCard

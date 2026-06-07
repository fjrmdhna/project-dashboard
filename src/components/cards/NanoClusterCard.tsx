"use client"

import { useMemo } from "react"
import { Hourglass, Target, Hexagon } from "lucide-react"
import {
  isMilestoneAchieved,
  resolveMilestoneColumns,
  type HermesMilestoneFields,
} from "@/lib/hermes-milestone-fields"
import { getValidNanoClusterName } from "@/lib/nano-cluster"

// Tipe data untuk mode input langsung counts
type CountsProps = {
  totalClusters: number
  count_lt50: number
  count_50_80: number
  count_80_99: number
  count_100: number
  count_completed: number
}

type ClusterAggregate = { total: number; ready: number; activated: number }

// Tipe data untuk mode input dari rows
type Row = {
  nano_cluster?: string | null
  imp_integ_af?: string | null
  rfs_af?: string | null
  readiness_2600_af?: string | null
  activation_2600_af?: string | null
}

type FromRowsProps = {
  rows: Row[]
  milestoneFields?: HermesMilestoneFields
  /** Pre-aggregated cluster data from useHermes5GDataOptimized (preferred) */
  aggregatedByCluster?: Map<string, ClusterAggregate>
}

// Union type untuk props komponen
type NanoClusterCardProps = CountsProps | FromRowsProps

// Type guard untuk menentukan jenis props
function isFromRows(props: NanoClusterCardProps): props is FromRowsProps {
  return 'rows' in props
}

function computeNanoClusterMetrics(
  clusterMap: Map<string, ClusterAggregate>
): CountsProps {
  let count_lt50 = 0
  let count_50_80 = 0
  let count_80_99 = 0
  let count_100 = 0
  let count_completed = 0

  clusterMap.forEach((data) => {
    const readinessPct = data.total > 0 ? (data.ready / data.total) * 100 : 0
    const activatedPct = data.total > 0 ? (data.activated / data.total) * 100 : 0

    if (readinessPct < 50) {
      count_lt50++
    } else if (readinessPct < 80) {
      count_50_80++
    } else if (readinessPct < 100) {
      count_80_99++
    } else if (readinessPct === 100) {
      count_100++
    }

    if (activatedPct === 100) {
      count_completed++
    }
  })

  return {
    totalClusters: clusterMap.size,
    count_lt50,
    count_50_80,
    count_80_99,
    count_100,
    count_completed,
  }
}

function aggregateClustersFromRows(
  rows: Row[],
  milestoneFields?: HermesMilestoneFields
): Map<string, ClusterAggregate> {
  const { readinessColumn, activatedColumn } = resolveMilestoneColumns(milestoneFields)
  const clusterMap = new Map<string, ClusterAggregate>()

  rows.forEach((row) => {
    const clusterName = getValidNanoClusterName(row.nano_cluster)
    if (!clusterName) return

    const clusterData = clusterMap.get(clusterName) || { total: 0, ready: 0, activated: 0 }
    clusterData.total++
    if (isMilestoneAchieved(row, readinessColumn)) clusterData.ready++
    if (isMilestoneAchieved(row, activatedColumn)) clusterData.activated++
    clusterMap.set(clusterName, clusterData)
  })

  return clusterMap
}

// Komponen metrik individual
interface MetricItemProps {
  icon: React.ReactNode
  value: number
  label: string
  bgColor: string
  textColor: string
  className?: string
}

function MetricItem({ icon, value, label, bgColor, textColor, className = "" }: MetricItemProps) {
  return (
    <div className={`flex items-center rounded-md border border-white/5 p-1 transition-all hover:border-white/10 hover:bg-white/5 min-w-0 h-full ${className}`}>
      <div className={`${bgColor} p-1 rounded-md mr-2 flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex items-center flex-1 min-w-0">
        <div className="text-lg font-bold leading-none mr-2" style={{ color: textColor }}>
          {value.toLocaleString()}
        </div>
        <div className="text-[9px] text-[#B0B7C3] leading-tight">
          {label === "Completed" ? label : `${label} readiness`}
        </div>
      </div>
    </div>
  )
}

export function NanoClusterCard(props: NanoClusterCardProps) {
  const metrics = useMemo(() => {
    if (!isFromRows(props)) {
      return props
    }

    const clusterMap =
      props.aggregatedByCluster && props.aggregatedByCluster.size > 0
        ? props.aggregatedByCluster
        : aggregateClustersFromRows(props.rows, props.milestoneFields)

    return computeNanoClusterMetrics(clusterMap)
  }, [
    isFromRows(props) ? props.rows : null,
    isFromRows(props) ? props.milestoneFields : null,
    isFromRows(props) ? props.aggregatedByCluster : null,
  ])

  const hasNoClusterData = metrics.totalClusters === 0

  if (hasNoClusterData) {
    return (
      <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1 overflow-hidden">
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="bg-indigo-500/20 p-0.5 rounded-sm">
              <Hexagon className="h-2.5 w-2.5 text-indigo-400" />
            </div>
            <div className="text-[8px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
              NANO CLUSTER
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-center px-2">
          <p className="text-[10px] text-white/50 leading-snug">
            No nano cluster data
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1 overflow-hidden">
      {/* Header - Compact horizontal layout */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-indigo-500/20 p-0.5 rounded-sm">
            <Hexagon className="h-2.5 w-2.5 text-indigo-400" />
          </div>
          <div className="text-[8px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
            NANO CLUSTER
          </div>
        </div>
        <div className="bg-indigo-500/10 px-1.5 py-0.5 rounded-sm flex items-center">
          <div className="text-[7px] text-indigo-300 mr-1">Total:</div>
          <div className="text-xs font-bold text-white">{metrics.totalClusters}</div>
        </div>
      </div>
      
      {/* Grid of metrics - Compact horizontal layout */}
      <div className="grid grid-cols-1 gap-1 flex-1 min-h-0 overflow-hidden">
        {/* Row 1: <50% and 50-80% */}
        <div className="grid grid-cols-2 gap-1">
          <MetricItem 
            icon={<Hourglass className="h-3 w-3 text-amber-400" />} 
            value={metrics.count_lt50} 
            label="<50%" 
            bgColor="bg-amber-500/20"
            textColor="#F59E0B"
          />
          
          <MetricItem 
            icon={<Hourglass className="h-3 w-3 text-yellow-400" />} 
            value={metrics.count_50_80} 
            label="50-80%" 
            bgColor="bg-yellow-500/20"
            textColor="#EAB308"
          />
        </div>
        
        {/* Row 2: 80-99% and 100% */}
        <div className="grid grid-cols-2 gap-1">
          <MetricItem 
            icon={<Hourglass className="h-3 w-3 text-lime-400" />} 
            value={metrics.count_80_99} 
            label="80-99%" 
            bgColor="bg-lime-500/20"
            textColor="#84CC16"
          />
          
          <MetricItem 
            icon={<Hourglass className="h-3 w-3 text-green-400" />} 
            value={metrics.count_100} 
            label="100%" 
            bgColor="bg-green-500/20"
            textColor="#22C55E"
          />
        </div>
        
        {/* Row 3: Completed - Full width */}
        <MetricItem 
          icon={<Target className="h-3 w-3 text-blue-400" />} 
          value={metrics.count_completed} 
          label="Completed" 
          bgColor="bg-blue-500/20"
          textColor="#3B82F6"
        />
      </div>
    </div>
  )
} 

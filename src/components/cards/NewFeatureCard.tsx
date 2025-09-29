"use client"

import { useMemo } from "react"
import { Hexagon, TrendingUp } from "lucide-react"

// Tipe data untuk props komponen
interface NanoClusterListCardProps {
  rows?: Array<{ 
    nano_cluster?: string | null
    imp_integ_af?: string | null
    rfs_af?: string | null
  }>
  className?: string
}

// Komponen item cluster individual
interface ClusterItemProps {
  clusterName: string
  readinessPct: number
  activatedPct: number
  totalSites: number
  readySites: number
  activatedSites: number
}

function ClusterItem({ clusterName, readinessPct, activatedPct, totalSites, readySites, activatedSites }: ClusterItemProps) {
  // Tentukan warna berdasarkan persentase readiness
  const getReadinessColor = (pct: number) => {
    if (pct < 50) return { bg: "bg-amber-500/20", text: "#F59E0B", border: "border-amber-500/30" }
    if (pct < 80) return { bg: "bg-yellow-500/20", text: "#EAB308", border: "border-yellow-500/30" }
    if (pct < 100) return { bg: "bg-lime-500/20", text: "#84CC16", border: "border-lime-500/30" }
    return { bg: "bg-green-500/20", text: "#22C55E", border: "border-green-500/30" }
  }

  // Tentukan warna untuk activated percentage
  const getActivatedColor = (pct: number) => {
    if (pct < 50) return "#F59E0B"
    if (pct < 80) return "#EAB308"
    if (pct < 100) return "#84CC16"
    return "#22C55E"
  }

  const readinessColor = getReadinessColor(readinessPct)
  const activatedColor = getActivatedColor(activatedPct)

  return (
    <div className={`flex items-center justify-between rounded-md border ${readinessColor.border} p-1.5 transition-all hover:bg-white/5 min-w-0`}>
      <div className="flex items-center flex-1 min-w-0">
        <div className={`${readinessColor.bg} p-1 rounded-md mr-2 flex-shrink-0`}>
          <Hexagon className="h-2.5 w-2.5" style={{ color: readinessColor.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-semibold text-white truncate">
            {clusterName}
          </div>
          <div className="text-[7px] text-[#B0B7C3]">
            {readySites}/{totalSites} sites
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end ml-2">
        <div className="text-[9px] font-bold" style={{ color: readinessColor.text }}>
          {readinessPct.toFixed(1)}% rdy
        </div>
        <div className="text-[8px] font-bold" style={{ color: activatedColor }}>
          {activatedPct.toFixed(1)}% act
        </div>
      </div>
    </div>
  )
}

export function NanoClusterListCard({ rows = [], className = "" }: NanoClusterListCardProps) {
  // Hitung dan sort cluster berdasarkan persentase readiness
  const sortedClusters = useMemo(() => {
    const clusterMap = new Map<string, { total: number, ready: number, activated: number }>()
    
    // Agregasi data per cluster
    rows.forEach(row => {
      const clusterName = row.nano_cluster
      if (!clusterName) return
      
      const clusterData = clusterMap.get(clusterName) || { total: 0, ready: 0, activated: 0 }
      clusterData.total++
      
      if (row.imp_integ_af !== null && row.imp_integ_af !== undefined) {
        clusterData.ready++
      }
      if (row.rfs_af !== null && row.rfs_af !== undefined) {
        clusterData.activated++
      }
      
      clusterMap.set(clusterName, clusterData)
    })
    
    // Convert ke array dan sort berdasarkan readiness dan activated yang sudah 100%
    return Array.from(clusterMap.entries())
      .map(([clusterName, data]) => ({
        clusterName,
        totalSites: data.total,
        readySites: data.ready,
        activatedSites: data.activated,
        readinessPct: data.total > 0 ? (data.ready / data.total) * 100 : 0,
        activatedPct: data.total > 0 ? (data.activated / data.total) * 100 : 0
      }))
      .sort((a, b) => {
        // Prioritas 1: Readiness 100% dan Activated 100%
        const aBoth100 = a.readinessPct === 100 && a.activatedPct === 100
        const bBoth100 = b.readinessPct === 100 && b.activatedPct === 100
        
        if (aBoth100 && !bBoth100) return -1
        if (!aBoth100 && bBoth100) return 1
        
        // Prioritas 2: Readiness 100% (tanpa activated 100%)
        const aReadiness100 = a.readinessPct === 100 && a.activatedPct < 100
        const bReadiness100 = b.readinessPct === 100 && b.activatedPct < 100
        
        if (aReadiness100 && !bReadiness100) return -1
        if (!aReadiness100 && bReadiness100) return 1
        
        // Prioritas 3: Activated 100% (tanpa readiness 100%)
        const aActivated100 = a.activatedPct === 100 && a.readinessPct < 100
        const bActivated100 = b.activatedPct === 100 && b.readinessPct < 100
        
        if (aActivated100 && !bActivated100) return -1
        if (!aActivated100 && bActivated100) return 1
        
        // Prioritas 4: Sort berdasarkan readiness descending
        return b.readinessPct - a.readinessPct
      })
  }, [rows])

  return (
    <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-indigo-500/20 p-0.5 rounded-sm">
            <TrendingUp className="h-2.5 w-2.5 text-indigo-400" />
          </div>
          <div className="text-[8px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
            CLUSTER LIST
          </div>
        </div>
        <div className="bg-indigo-500/10 px-1.5 py-0.5 rounded-sm flex items-center">
          <div className="text-[7px] text-indigo-300 mr-1">Total:</div>
          <div className="text-xs font-bold text-white">{sortedClusters.length}</div>
        </div>
      </div>
      
      {/* Scrollable list of clusters */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="space-y-1">
          {sortedClusters.map((cluster, index) => (
            <ClusterItem
              key={cluster.clusterName}
              clusterName={cluster.clusterName}
              readinessPct={cluster.readinessPct}
              activatedPct={cluster.activatedPct}
              totalSites={cluster.totalSites}
              readySites={cluster.readySites}
              activatedSites={cluster.activatedSites}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
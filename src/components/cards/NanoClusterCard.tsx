"use client"

import { useMemo } from "react"
import { Hourglass, Target, Hexagon } from "lucide-react"

// Tipe data untuk mode input langsung counts
type CountsProps = {
  totalClusters: number
  count_lt50: number
  count_50_80: number
  count_80_99: number
  count_100: number
  count_completed: number
}

// Tipe data untuk mode input dari rows
type Row = { 
  nano_cluster?: string | null
  imp_integ_af?: string | null
  rfs_af?: string | null
}

type FromRowsProps = {
  rows: Row[]
}

// Union type untuk props komponen
type NanoClusterCardProps = CountsProps | FromRowsProps

// Type guard untuk menentukan jenis props
function isFromRows(props: NanoClusterCardProps): props is FromRowsProps {
  return 'rows' in props
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
    <div className={`flex flex-col items-center rounded-md border border-white/5 p-1 transition-all hover:border-white/10 hover:bg-white/5 min-w-0 ${className}`}>
      <div className={`${bgColor} p-1.5 rounded-md mb-1.5 self-start`}>
        {icon}
      </div>
      <div className="text-lg font-bold mb-0.5 self-start" style={{ color: textColor }}>
        {value.toLocaleString()}
      </div>
      <div className="text-[8px] text-[#B0B7C3] self-start leading-tight">
        {label}
      </div>
    </div>
  )
}

export function NanoClusterCard(props: NanoClusterCardProps) {
  // Hitung metrics dari rows jika dalam mode FromRowsProps
  const metrics = useMemo(() => {
    if (!isFromRows(props)) {
      return props
    }

    const { rows } = props
    const clusterMap = new Map<string, { total: number, ready: number, activated: number }>()
    
    // Iterasi setiap row untuk agregasi data per cluster
    rows.forEach(row => {
      const clusterName = row.nano_cluster
      
      // Skip rows tanpa nano_cluster
      if (!clusterName) return
      
      // Ambil atau inisialisasi data cluster
      const clusterData = clusterMap.get(clusterName) || { total: 0, ready: 0, activated: 0 }
      
      // Update counters
      clusterData.total++
      if (row.imp_integ_af !== null && row.imp_integ_af !== undefined) {
        clusterData.ready++
      }
      if (row.rfs_af !== null && row.rfs_af !== undefined) {
        clusterData.activated++
      }
      
      // Simpan kembali ke map
      clusterMap.set(clusterName, clusterData)
    })
    
    // Hitung metrics berdasarkan persentase readiness dan activation
    let count_lt50 = 0
    let count_50_80 = 0
    let count_80_99 = 0
    let count_100 = 0
    let count_completed = 0
    
    clusterMap.forEach(data => {
      const readinessPct = data.total > 0 ? (data.ready / data.total) * 100 : 0
      const activatedPct = data.total > 0 ? (data.activated / data.total) * 100 : 0
      
      // Cluster yang 100% activated dihitung sebagai completed
      if (activatedPct === 100) {
        count_completed++
        return
      }
      
      // Binning berdasarkan persentase readiness
      if (readinessPct < 50) {
        count_lt50++
      } else if (readinessPct < 80) {
        count_50_80++
      } else if (readinessPct < 100) {
        count_80_99++
      } else if (readinessPct === 100) {
        count_100++
      }
    })
    
    return {
      totalClusters: clusterMap.size,
      count_lt50,
      count_50_80,
      count_80_99,
      count_100,
      count_completed
    }
  }, [isFromRows(props) ? props.rows : null])
  
  return (
    <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-indigo-500/20 p-0.5 rounded-sm">
            <Hexagon className="h-2.5 w-2.5 text-indigo-400" />
          </div>
          <div className="text-[8px] font-medium bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded-full">
            NANO CLUSTER
          </div>
        </div>
        <div className="bg-indigo-500/10 px-1.5 py-0.5 rounded-sm flex items-center">
          <div className="text-[8px] text-indigo-300 mr-0.5">Total:</div>
          <div className="text-sm font-bold text-white">{metrics.totalClusters}</div>
        </div>
      </div>
      
      {/* Grid of metrics - 3 in top row, 2 in bottom row */}
      <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
        {/* Top row: 3 items */}
        <MetricItem 
          icon={<Hourglass className="h-4 w-4 text-amber-400" />} 
          value={metrics.count_lt50} 
          label="Cluster Readiness <50%" 
          bgColor="bg-amber-500/20"
          textColor="#F59E0B"
          className="col-span-1"
        />
        
        <MetricItem 
          icon={<Hourglass className="h-4 w-4 text-yellow-400" />} 
          value={metrics.count_50_80} 
          label="Cluster Readiness 50-80%" 
          bgColor="bg-yellow-500/20"
          textColor="#EAB308"
          className="col-span-1"
        />
        
        <MetricItem 
          icon={<Hourglass className="h-4 w-4 text-lime-400" />} 
          value={metrics.count_80_99} 
          label="Cluster Readiness 80-99%" 
          bgColor="bg-lime-500/20"
          textColor="#84CC16"
          className="col-span-1"
        />
        
        {/* Bottom row: 2 items centered */}
        <MetricItem 
          icon={<Hourglass className="h-4 w-4 text-green-400" />} 
          value={metrics.count_100} 
          label="Cluster Readiness 100%" 
          bgColor="bg-green-500/20"
          textColor="#22C55E"
          className="col-span-1 col-start-1 row-start-2"
        />
        
        <MetricItem 
          icon={<Target className="h-4 w-4 text-blue-400" />} 
          value={metrics.count_completed} 
          label="Cluster Completed (100% Activated)" 
          bgColor="bg-blue-500/20"
          textColor="#3B82F6"
          className="col-span-2 col-start-2 row-start-2"
        />
      </div>
    </div>
  )
} 
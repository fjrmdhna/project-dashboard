"use client"

import { useMemo } from "react"
import { MapPin, TrendingUp } from "lucide-react"

// Tipe data untuk props komponen
interface CircleListCardProps {
  rows?: Array<{ 
    region_circle?: string | null
    imp_integ_af?: string | null
    rfs_af?: string | null
  }>
  className?: string
}

// Komponen item circle individual
interface CircleItemProps {
  circleName: string
  activatedPct: number
  totalSites: number
  activatedSites: number
}

function CircleItem({ circleName, activatedPct, totalSites, activatedSites }: CircleItemProps) {
  // Tentukan warna berdasarkan persentase activated
  const getActivatedColor = (pct: number) => {
    if (pct < 50) return { bg: "bg-amber-500/20", text: "#F59E0B", border: "border-amber-500/30" }
    if (pct < 80) return { bg: "bg-yellow-500/20", text: "#EAB308", border: "border-yellow-500/30" }
    if (pct < 100) return { bg: "bg-lime-500/20", text: "#84CC16", border: "border-lime-500/30" }
    return { bg: "bg-green-500/20", text: "#22C55E", border: "border-green-500/30" }
  }

  const activatedColor = getActivatedColor(activatedPct)

  return (
    <div className={`flex items-center justify-between rounded-md border ${activatedColor.border} p-1.5 transition-all hover:bg-white/5 min-w-0`}>
      <div className="flex items-center flex-1 min-w-0">
        <div className={`${activatedColor.bg} p-1 rounded-md mr-2 flex-shrink-0`}>
          <MapPin className="h-2.5 w-2.5" style={{ color: activatedColor.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-semibold text-white truncate">
            {circleName}
          </div>
          <div className="text-[7px] text-[#B0B7C3]">
            {activatedSites}/{totalSites} sites
          </div>
        </div>
      </div>
      <div className="flex items-center ml-2">
        <div className="text-[10px] font-bold" style={{ color: activatedColor.text }}>
          {activatedPct.toFixed(1)}% act
        </div>
      </div>
    </div>
  )
}

// Normalize circle name - trim, lowercase for grouping key
const normalizeCircleName = (name: string): string => {
  return name.trim().toLowerCase()
}

// Format circle name with Title Case for display
const formatCircleName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function CircleListCard({ rows = [], className = "" }: CircleListCardProps) {
  // Hitung dan sort circle berdasarkan persentase readiness
  const sortedCircles = useMemo(() => {
    // Use normalized key for grouping to avoid duplicates from case/whitespace variations
    const circleMap = new Map<string, { displayName: string, total: number, ready: number, activated: number }>()
    
    // Agregasi data per circle (normalize key to merge variations)
    rows.forEach(row => {
      const rawCircleName = row.region_circle
      if (!rawCircleName) return
      
      const normalizedKey = normalizeCircleName(rawCircleName)
      const displayName = formatCircleName(rawCircleName)
      
      const circleData = circleMap.get(normalizedKey) || { displayName, total: 0, ready: 0, activated: 0 }
      circleData.total++
      
      if (row.imp_integ_af !== null && row.imp_integ_af !== undefined) {
        circleData.ready++
      }
      if (row.rfs_af !== null && row.rfs_af !== undefined) {
        circleData.activated++
      }
      
      circleMap.set(normalizedKey, circleData)
    })
    
    // Convert ke array dan sort berdasarkan readiness dan activated yang sudah 100%
    return Array.from(circleMap.entries())
      .map(([normalizedKey, data]) => ({
        id: normalizedKey, // Unique key for React
        circleName: data.displayName,
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
            CIRCLE LIST
          </div>
        </div>
        <div className="bg-indigo-500/10 px-1.5 py-0.5 rounded-sm flex items-center">
          <div className="text-[7px] text-indigo-300 mr-1">Total:</div>
          <div className="text-xs font-bold text-white">{sortedCircles.length}</div>
        </div>
      </div>
      
      {/* Scrollable list of circles */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="space-y-1">
          {sortedCircles.map((circle) => (
            <CircleItem
              key={circle.id}
              circleName={circle.circleName}
              activatedPct={circle.activatedPct}
              totalSites={circle.totalSites}
              activatedSites={circle.activatedSites}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Keep backward compatibility with old name (deprecated)
/** @deprecated Use CircleListCard instead */
export const NanoClusterListCard = CircleListCard

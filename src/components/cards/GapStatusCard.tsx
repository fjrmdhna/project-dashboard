"use client"

import { useMemo } from "react"
import { AlertCircle, Clock, CheckCircle } from "lucide-react"

// Tipe data untuk row dari site_data_aop
type Row = {
  system_key?: string | null
  rfs_af?: string | null // RFS Actual
  rfc_approved?: string | null // RFC Approved
  hotnews_af?: string | null // Hotnews
  endorse_af?: string | null // Endorse
}

type GapStatusCardProps = {
  rows: Row[]
  isLoading?: boolean
}

// Komponen metrik individual untuk gap status
interface GapMetricItemProps {
  icon: React.ReactNode
  value: number
  label: string
  bgColor: string
  textColor: string
  className?: string
}

function GapMetricItem({ 
  icon, 
  value, 
  label, 
  bgColor, 
  textColor, 
  className = "" 
}: GapMetricItemProps) {
  return (
    <div className={`flex items-center rounded-md border border-white/5 p-1 transition-all hover:border-white/10 hover:bg-white/5 min-w-0 h-full ${className}`}>
      <div className={`${bgColor} p-1 rounded-md mr-2 flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="text-lg font-bold leading-none" style={{ color: textColor }}>
          {value.toLocaleString()}
        </div>
        <div className="text-[9px] font-semibold text-white/90 leading-tight">
          {label}
        </div>
      </div>
    </div>
  )
}

// Helper function to check if date string is valid
function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  try {
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  } catch {
    return false
  }
}

export function GapStatusCard({ rows, isLoading = false }: GapStatusCardProps) {
  // Hitung gap metrics dari rows
  const gapMetrics = useMemo(() => {
    if (isLoading || !rows || rows.length === 0) {
      return {
        rfsToRfc: 0,
        rfsToHotnews: 0,
        rfsToEndorse: 0,
        total: 0
      }
    }
    
    let rfsToRfc = 0      // RFS ada, tapi RFC belum ada
    let rfsToHotnews = 0  // RFS ada, tapi Hotnews belum ada
    let rfsToEndorse = 0  // RFS ada, tapi Endorse belum ada
    
    rows.forEach(row => {
      const hasRfsAf = isValidDate(row.rfs_af)
      
      // Hanya hitung jika sudah RFS
      if (hasRfsAf) {
        const hasRfc = isValidDate(row.rfc_approved)
        const hasHotnews = isValidDate(row.hotnews_af)
        const hasEndorse = isValidDate(row.endorse_af)
        
        // RFS to RFC gap
        if (!hasRfc) {
          rfsToRfc++
        }
        
        // RFS to Hotnews gap
        if (!hasHotnews) {
          rfsToHotnews++
        }
        
        // RFS to Endorse gap
        if (!hasEndorse) {
          rfsToEndorse++
        }
      }
    })
    
    return {
      rfsToRfc,
      rfsToHotnews,
      rfsToEndorse,
      total: rows.filter(row => isValidDate(row.rfs_af)).length
    }
  }, [rows, isLoading])
  
  if (isLoading) {
    return (
      <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex items-center justify-center p-1">
        <div className="animate-pulse text-white/50 text-[9px]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col text-white min-w-0 p-1 overflow-hidden">
      {/* Header - Compact horizontal layout */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-orange-500/20 p-0.5 rounded-sm">
            <AlertCircle className="h-2.5 w-2.5 text-orange-400" />
          </div>
          <div className="text-[8px] font-semibold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">
            GAP STATUS
          </div>
        </div>
        <div className="bg-orange-500/10 px-1.5 py-0.5 rounded-sm flex items-center">
          <div className="text-[7px] text-orange-300 mr-1">RFS:</div>
          <div className="text-xs font-bold text-white">{gapMetrics.total.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Grid of gap metrics */}
      <div className="grid grid-cols-1 gap-1 flex-1 min-h-0 overflow-hidden">
        {/* Gap 1: RFS to RFC */}
        <GapMetricItem 
          icon={<Clock className="h-3 w-3 text-cyan-400" />} 
          value={gapMetrics.rfsToRfc} 
          label="RFS to RFC" 
          bgColor="bg-cyan-500/20"
          textColor="#22D3EE"
        />
        
        {/* Gap 2: RFS to Hotnews */}
        <GapMetricItem 
          icon={<AlertCircle className="h-3 w-3 text-yellow-400" />} 
          value={gapMetrics.rfsToHotnews} 
          label="RFS to Hotnews" 
          bgColor="bg-yellow-500/20"
          textColor="#EAB308"
        />
        
        {/* Gap 3: RFS to Endorse */}
        <GapMetricItem 
          icon={<CheckCircle className="h-3 w-3 text-green-400" />} 
          value={gapMetrics.rfsToEndorse} 
          label="RFS to Endorse" 
          bgColor="bg-green-500/20"
          textColor="#22C55E"
        />
      </div>
    </div>
  )
}


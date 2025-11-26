"use client"

import { useMemo } from "react"
import { AlertCircle, Clock, CheckCircle } from "lucide-react"

// Tipe data untuk row dari site_data_aop
type Row = {
  system_key?: string | null
  ic_000040_af?: string | null // Install equivalent (ic_000010_af di database)
  caf_approved?: string | null // RFI accepted equivalent (rfi_accepted di database)
  rfs_af?: string | null // Activated
}

type GapStatusCardProps = {
  rows: Row[]
}

// Komponen metrik individual untuk gap status
interface GapMetricItemProps {
  icon: React.ReactNode
  value: number
  label: string
  bgColor: string
  textColor: string
  description: string
  className?: string
}

function GapMetricItem({ 
  icon, 
  value, 
  label, 
  bgColor, 
  textColor, 
  description,
  className = "" 
}: GapMetricItemProps) {
  return (
    <div className={`flex items-center rounded-md border border-white/5 p-1 transition-all hover:border-white/10 hover:bg-white/5 min-w-0 h-full ${className}`}>
      <div className={`${bgColor} p-1 rounded-md mr-2 flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold leading-none" style={{ color: textColor }}>
            {value.toLocaleString()}
          </div>
          <div className="text-[9px] font-semibold text-white/90 leading-tight">
            {label}
          </div>
        </div>
        <div className="text-[8px] text-[#B0B7C3] leading-tight mt-0.5">
          {description}
        </div>
      </div>
    </div>
  )
}

export function GapStatusCard({ rows }: GapStatusCardProps) {
  // Hitung gap metrics dari rows
  const gapMetrics = useMemo(() => {
    let sowToRfi = 0 // system_key ada tapi ic_000040_af kosong
    let rfiToCrfi = 0 // ic_000040_af terisi tapi caf_approved kosong
    let crfiToOa = 0 // caf_approved terisi tapi rfs_af kosong
    
    rows.forEach(row => {
      // Validasi: row harus punya system_key untuk dihitung
      if (!row.system_key) return
      
      // Gap 1: SOW - RFI
      // Kondisi: system_key ada tapi ic_000040_af kosong/null
      const hasSystemKey = !!(row.system_key && String(row.system_key).trim() !== '')
      const hasIc000040Af = !!(row.ic_000040_af && String(row.ic_000040_af).trim() !== '')
      
      if (hasSystemKey && !hasIc000040Af) {
        sowToRfi++
      }
      
      // Gap 2: RFI - CRFI
      // Kondisi: ic_000040_af terisi tapi caf_approved kosong/null
      const hasCafApproved = !!(row.caf_approved && String(row.caf_approved).trim() !== '')
      
      if (hasIc000040Af && !hasCafApproved) {
        rfiToCrfi++
      }
      
      // Gap 3: CRFI - OA
      // Kondisi: caf_approved terisi tapi rfs_af kosong/null
      const hasRfsAf = !!(row.rfs_af && String(row.rfs_af).trim() !== '')
      
      if (hasCafApproved && !hasRfsAf) {
        crfiToOa++
      }
    })
    
    return {
      sowToRfi,
      rfiToCrfi,
      crfiToOa,
      total: rows.filter(row => !!(row.system_key && String(row.system_key).trim() !== '')).length
    }
  }, [rows])
  
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
          <div className="text-[7px] text-orange-300 mr-1">Total:</div>
          <div className="text-xs font-bold text-white">{gapMetrics.total.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Grid of gap metrics */}
      <div className="grid grid-cols-1 gap-1 flex-1 min-h-0 overflow-hidden">
        {/* Gap 1: SOW - RFI */}
        <GapMetricItem 
          icon={<Clock className="h-3 w-3 text-amber-400" />} 
          value={gapMetrics.sowToRfi} 
          label="SOW - RFI" 
          bgColor="bg-amber-500/20"
          textColor="#F59E0B"
          description="System key exists, no installation"
        />
        
        {/* Gap 2: RFI - CRFI */}
        <GapMetricItem 
          icon={<AlertCircle className="h-3 w-3 text-yellow-400" />} 
          value={gapMetrics.rfiToCrfi} 
          label="RFI - CRFI" 
          bgColor="bg-yellow-500/20"
          textColor="#EAB308"
          description="Installation done, not accepted"
        />
        
        {/* Gap 3: CRFI - OA */}
        <GapMetricItem 
          icon={<CheckCircle className="h-3 w-3 text-lime-400" />} 
          value={gapMetrics.crfiToOa} 
          label="CRFI - OA" 
          bgColor="bg-lime-500/20"
          textColor="#84CC16"
          description="Accepted, not activated"
        />
      </div>
    </div>
  )
}


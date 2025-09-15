"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"

// Tipe data untuk row dari site_data_5g
export interface Row {
  system_key: string
  caf_approved?: string | null
  mos_af?: string | null
  ic_000040_af?: string | null
  imp_integ_af?: string | null
  rfs_af?: string | null
  rfs_forecast_lock?: string | null
  hotnews_af?: string | null
  endorse_af?: string | null
  vendor_name?: string
  program_report?: string
  imp_ttp?: string
}

// Props untuk MatrixStatsCard
export interface MatrixStatsCardProps {
  rows: Row[]
  patpCount?: number
}

// Komponen untuk menampilkan metrik tunggal
function MetricItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center flex flex-col items-center justify-center min-w-0">
      <div className="text-xs font-bold">{value.toLocaleString()}</div>
      <div className="text-[7px] text-[#B0B7C3] leading-none">{label}</div>
    </div>
  )
}

export function MatrixStatsCard({ rows, patpCount = 0 }: MatrixStatsCardProps) {
  // Menghitung statistik dari rows yang difilter
  const stats = useMemo(() => {
    const totalSites = rows.length
    const caf = rows.filter(row => row.caf_approved).length
    const mos = rows.filter(row => row.mos_af).length
    const install = rows.filter(row => row.ic_000040_af).length
    const readiness = rows.filter(row => row.imp_integ_af).length
    const activated = rows.filter(row => row.rfs_af).length
    const hotnews = rows.filter(row => row.hotnews_af).length
    const endorse = rows.filter(row => row.endorse_af).length
    const patp = patpCount // Menggunakan nilai dari props

    return {
      totalSites,
      caf,
      mos,
      install,
      readiness,
      activated,
      patp,
      hotnews,
      endorse
    }
  }, [rows, patpCount])

  return (
    <div className="rounded-lg bg-[#0F1630]/80 border border-white/5 p-1 w-full h-full flex flex-col min-w-0 matrix-compact mb-1">
      {/* Header */}
      <div className="flex items-center gap-0.5 mb-0 flex-shrink-0">
        <div className="bg-blue-500/20 p-0.5 rounded-sm">
          <BarChart3 className="h-2 w-2 text-blue-400" />
        </div>
        <div className="text-[7px] font-medium bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded-full">
          Matrix Statistics
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row items-center flex-1 min-h-0">
        <div className="flex items-center gap-1 mb-0.5 md:mb-0 md:mr-2 flex-shrink-0">
          <div>
            <div className="text-sm font-bold">{stats.totalSites}</div>
            <div className="text-[7px] text-[#B0B7C3] leading-none">Total Sites</div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 md:grid-cols-8 gap-0.5 w-full">
          <MetricItem label="CAF" value={stats.caf} />
          <MetricItem label="MOS" value={stats.mos} />
          <MetricItem label="INSTALL" value={stats.install} />
          <MetricItem label="READINESS" value={stats.readiness} />
          <MetricItem label="ACTIVATED" value={stats.activated} />
          <MetricItem label="PATP" value={stats.patp} />
          <MetricItem label="HOT NEWS" value={stats.hotnews} />
          <MetricItem label="ENDORSE" value={stats.endorse} />
        </div>
      </div>
    </div>
  )
} 

"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"

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
  lat?: number | null
  long?: number | null
}

export interface MatrixStatsCardProps {
  rows: Row[]
  patpCount?: number
}

const METRIC_CONFIG = [
  { key: "caf", label: "CAF" },
  { key: "mos", label: "MOS" },
  { key: "install", label: "INSTALL" },
  { key: "readiness", label: "READINESS" },
  { key: "activated", label: "ACTIVATED" },
  { key: "patp", label: "PATP" },
  { key: "hotnews", label: "HOT NEWS" },
  { key: "endorse", label: "ENDORSE" }
] as const

type MetricKey = (typeof METRIC_CONFIG)[number]["key"]

type MetricMap = Record<MetricKey, number>

function MetricItem({
  label,
  value
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col items-center text-center min-w-[56px]">
      <span className="text-[11px] font-semibold text-white leading-tight">
        {value.toLocaleString()}
      </span>
      <span className="text-[7px] uppercase tracking-[0.16em] text-[#90A0C4] leading-tight">
        {label}
      </span>
    </div>
  )
}

export function MatrixStatsCard({ rows, patpCount = 0 }: MatrixStatsCardProps) {
  const stats = useMemo(() => {
    const totalSites = rows.length
    const caf = rows.filter(row => row.caf_approved).length
    const mos = rows.filter(row => row.mos_af).length
    const install = rows.filter(row => row.ic_000040_af).length
    const readiness = rows.filter(row => row.imp_integ_af).length
    const activated = rows.filter(row => row.rfs_af).length
    const hotnews = rows.filter(row => row.hotnews_af).length
    const endorse = rows.filter(row => row.endorse_af).length
    const patp = patpCount

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

  const metrics: MetricMap = {
    caf: stats.caf,
    mos: stats.mos,
    install: stats.install,
    readiness: stats.readiness,
    activated: stats.activated,
    patp: stats.patp,
    hotnews: stats.hotnews,
    endorse: stats.endorse
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/85 border border-white/5 w-full h-full matrix-compact text-white px-3 py-2">
      <div className="flex h-full flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="bg-blue-500/15 p-0.5 rounded-sm">
            <BarChart3 className="h-2.5 w-2.5 text-blue-300" />
          </div>
          <div className="text-[8px] font-semibold uppercase tracking-[0.18em] bg-blue-500/15 text-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight">
            Matrix Statistics
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 gap-y-1">
          <div className="flex flex-col items-center text-center min-w-[64px]">
            <span className="text-lg font-bold leading-none">
              {stats.totalSites.toLocaleString()}
            </span>
            <span className="text-[8px] uppercase tracking-[0.18em] text-[#90A0C4]">
              Total Sites
            </span>
          </div>

          {METRIC_CONFIG.map(({ key, label }) => (
            <MetricItem key={key} label={label} value={metrics[key]} />
          ))}
        </div>
      </div>
    </div>
  )
}

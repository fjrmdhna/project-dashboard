"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"

export interface Row {
  system_key: string
  caf_approved?: string | null
  mos_af?: string | null
  ic_000040_af?: string | null
  ic_000010_af?: string | null // RFI header for AOP
  rfi_accepted?: string | null // CRFI for AOP
  imp_integ_af?: string | null
  rfs_af?: string | null
  rfs_forecast_lock?: string | null
  rfc_approved?: string | null
  hotnews_af?: string | null
  endorse_af?: string | null
  pac_accepted_af?: string | null
  vendor_name?: string
  program_report?: string
  imp_ttp?: string
  lat?: number | null
  long?: number | null
}

export interface MatrixStatsCardProps {
  rows: Row[]
  patpCount?: number
  variant?: "default" | "newSite"
}

// Default metric configuration (Hermes 5G)
const DEFAULT_METRIC_CONFIG = [
  { key: "caf", label: "CAF" },
  { key: "mos", label: "MOS" },
  { key: "install", label: "INSTALL" },
  { key: "readiness", label: "READINESS" },
  { key: "activated", label: "ACTIVATED" },
  { key: "rfc", label: "RFC" },
  { key: "patp", label: "PATP" },
  { key: "hotnews", label: "HN" },
  { key: "endorse", label: "ENDORSE" },
  { key: "pac", label: "PAC" }
] as const

// New Site metric configuration
const NEW_SITE_METRIC_CONFIG = [
  { key: "rfi", label: "RFI" },
  { key: "crfi", label: "CRFI" },
  { key: "mos", label: "MOS" },
  { key: "install", label: "INSTALL" },
  { key: "rfs", label: "RFS" },
  { key: "rfc", label: "RFC" },
  { key: "patp", label: "PATP" },
  { key: "hotnews", label: "HN" },
  { key: "endorse", label: "ENDORSE" },
  { key: "pac", label: "PAC" }
] as const

type MetricKey = (typeof DEFAULT_METRIC_CONFIG)[number]["key"] | (typeof NEW_SITE_METRIC_CONFIG)[number]["key"]

type MetricMap = Partial<Record<MetricKey, number>>

function MetricItem({
  label,
  value
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col items-center text-center min-w-[56px] justify-center">
      <span className="text-[11px] font-semibold text-white leading-tight">
        {value.toLocaleString()}
      </span>
      <span className="text-[7px] uppercase tracking-[0.16em] text-[#90A0C4] leading-tight">
        {label}
      </span>
    </div>
  )
}

export function MatrixStatsCard({ rows, patpCount = 0, variant = "default" }: MatrixStatsCardProps) {
  const stats = useMemo(() => {
    const totalSites = rows.length
    
    if (variant === "newSite") {
      // New Site variant metrics
      const rfi = rows.filter(row => row.ic_000010_af).length
      const crfi = rows.filter(row => row.rfi_accepted).length
      const mos = rows.filter(row => row.mos_af).length
      const install = rows.filter(row => row.ic_000040_af).length
      const rfs = rows.filter(row => row.rfs_af).length
      const rfc = rows.filter(row => row.rfc_approved).length
      const hotnews = rows.filter(row => row.hotnews_af).length
      const endorse = rows.filter(row => row.endorse_af).length
      const pac = rows.filter(row => row.pac_accepted_af).length
      const patp = patpCount

      return {
        totalSites,
        rfi,
        crfi,
        mos,
        install,
        rfs,
        rfc,
        patp,
        hotnews,
        endorse,
        pac
      }
    } else {
      // Default variant metrics (Hermes 5G)
    const caf = rows.filter(row => row.caf_approved).length
    const mos = rows.filter(row => row.mos_af).length
    const install = rows.filter(row => row.ic_000040_af).length
    const readiness = rows.filter(row => row.imp_integ_af).length
    const activated = rows.filter(row => row.rfs_af).length
    const rfc = rows.filter(row => row.rfc_approved).length
    const hotnews = rows.filter(row => row.hotnews_af).length
    const endorse = rows.filter(row => row.endorse_af).length
    const pac = rows.filter(row => row.pac_accepted_af).length
    const patp = patpCount

    return {
      totalSites,
      caf,
      mos,
      install,
      readiness,
      activated,
      rfc,
      patp,
      hotnews,
      endorse,
      pac
    }
    }
  }, [rows, patpCount, variant])

  const metricConfig = variant === "newSite" ? NEW_SITE_METRIC_CONFIG : DEFAULT_METRIC_CONFIG

  const metrics: MetricMap = variant === "newSite" 
    ? {
        rfi: stats.rfi!,
        crfi: stats.crfi!,
        mos: stats.mos,
        install: stats.install,
        rfs: stats.rfs!,
        rfc: stats.rfc,
        patp: stats.patp,
        hotnews: stats.hotnews,
        endorse: stats.endorse,
        pac: stats.pac
      }
    : {
        caf: stats.caf!,
    mos: stats.mos,
    install: stats.install,
        readiness: stats.readiness!,
        activated: stats.activated!,
    rfc: stats.rfc,
    patp: stats.patp,
    hotnews: stats.hotnews,
    endorse: stats.endorse,
    pac: stats.pac
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

        <div className="flex flex-wrap items-center justify-center gap-3 gap-y-1">
          <div className="flex flex-col items-center text-center min-w-[64px] justify-center">
            <span className="text-lg font-bold leading-none">
              {stats.totalSites.toLocaleString()}
            </span>
            <span className="text-[8px] uppercase tracking-[0.18em] text-[#90A0C4]">
              Total Sites
            </span>
          </div>

          {metricConfig.map(({ key, label }) => (
            <MetricItem key={key} label={label} value={metrics[key] ?? 0} />
          ))}
        </div>
      </div>
    </div>
  )
}

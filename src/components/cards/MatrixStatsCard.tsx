"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import {
  isMilestoneAchieved,
  resolveMilestoneColumns,
  type HermesMilestoneFields,
} from "@/lib/hermes-milestone-fields"

export interface Row {
  system_key: string
  site_status?: string | null
  caf_approved?: string | null
  mos_af?: string | null
  ic_000040_af?: string | null
  ic_000010_af?: string | null // RFI header for AOP
  rfi_accepted?: string | null // CRFI for AOP
  imp_integ_af?: string | null
  rfs_af?: string | null
  rfs_forecast_lock?: string | null
  ready_for_acpt_date?: string | null  // RFA - Ready for Acceptance (AOP)
  rfc_approved?: string | null
  fatp_accepted_af?: string | null  // FATP - Matrix milestone (AOP)
  hotnews_af?: string | null
  endorse_af?: string | null
  pac_accepted_af?: string | null
  patp_accepted_af?: string | null
  readiness_2600_af?: string | null
  activation_2600_af?: string | null
  vendor_name?: string | null
  program_report?: string | null
  imp_ttp?: string | null
  lat?: number | null
  long?: number | null
}

export interface MatrixStatsCardProps {
  rows: Row[]
  patpCount?: number
  variant?: "default" | "aop" | "tlp"
  milestoneFields?: HermesMilestoneFields
  stats?: {
    totalSites?: number
    // AOP variant stats
    rfi?: number
    crfi?: number
    // TLP variant stats
    construction?: number
    returnCount?: number
    searching?: number
    sitac?: number
    // Hermes 5G variant stats
    caf?: number
    // Common stats
    mos?: number
    install?: number
    rfs?: number
    rfa?: number   // RFA - Ready for Acceptance (ready_for_acpt_date)
    activated?: number
    readiness?: number
    rfc?: number
    fatp?: number  // FATP (fatp_accepted_af)
    patp?: number  // PATP (patp_accepted_af)
    hotnews?: number
    endorse?: number
    pac?: number
  }
}

// Default metric configuration (Hermes 5G)
const DEFAULT_METRIC_CONFIG = [
  { key: "caf", label: "CAF" },
  { key: "mos", label: "MOS" },
  { key: "install", label: "INSTALL" },
  { key: "readiness", label: "READINESS" },
  { key: "activated", label: "ACTIVATED" },
  { key: "rfa", label: "RFA" },
  { key: "rfc", label: "RFC" },
  { key: "fatp", label: "FATP" },
  { key: "patp", label: "PATP" },
  { key: "hotnews", label: "HN" },
  { key: "endorse", label: "ENDORSE" },
  { key: "pac", label: "PAC" }
] as const

// TLP New Site — Total Sites is shown separately; these match site_data_tlp columns
const TLP_METRIC_CONFIG = [
  { key: "crfi", label: "CRFI" },
  { key: "rfi", label: "RFI" },
  { key: "construction", label: "CONSTRUCTION" },
  { key: "rfc", label: "RFC" },
  { key: "sitac", label: "SITAC" },
  { key: "searching", label: "SEARCHING" },
  { key: "returnCount", label: "RETURN" },
] as const

// AOP metric configuration (FATP after RFC)
const AOP_METRIC_CONFIG = [
  { key: "rfi", label: "RFI" },
  { key: "crfi", label: "CRFI" },
  { key: "mos", label: "MOS" },
  { key: "install", label: "INSTALL" },
  { key: "rfs", label: "RFS" },
  { key: "rfa", label: "RFA" },
  { key: "rfc", label: "RFC" },
  { key: "fatp", label: "FATP" },
  { key: "patp", label: "PATP" },
  { key: "hotnews", label: "HN" },
  { key: "endorse", label: "ENDORSE" },
  { key: "pac", label: "PAC" }
] as const

type MetricKey =
  | (typeof DEFAULT_METRIC_CONFIG)[number]["key"]
  | (typeof AOP_METRIC_CONFIG)[number]["key"]
  | (typeof TLP_METRIC_CONFIG)[number]["key"]

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
      <span className="text-lg font-bold leading-none text-white">
        {value.toLocaleString()}
      </span>
      <span className="text-[8px] uppercase tracking-[0.18em] text-[#90A0C4] leading-tight">
        {label}
      </span>
    </div>
  )
}

function hasMeaningfulField(value: unknown): boolean {
  if (value === null || value === undefined) return false
  return String(value).trim() !== ""
}

function normalizeSiteStatus(value: string | null | undefined): string {
  if (!hasMeaningfulField(value)) return ""
  const normalized = String(value).trim().toUpperCase()

  if (normalized.includes("PROPOSED RETURN")) return "RETURN"
  if (normalized.includes("RETURN")) return "RETURN"
  if (normalized.includes("CONSTRUCTION")) return "CONSTRUCTION"
  if (normalized.includes("SEARCHING")) return "SEARCHING"
  if (normalized.includes("SITAC")) return "SITAC"
  if (normalized.includes("CRFI")) return "CRFI"
  if (normalized.includes("SRFI")) return "RFI"
  if (normalized.includes("RFI")) return "RFI"
  if (normalized.includes("RFC")) return "RFC"

  return normalized
}

export function MatrixStatsCard({ rows, patpCount = 0, variant = "default", milestoneFields, stats: providedStats }: MatrixStatsCardProps) {
  const { readinessColumn, activatedColumn } = resolveMilestoneColumns(milestoneFields)

  const stats = useMemo(() => {
    const countReadiness = (data: Row[]) =>
      data.filter((row) => isMilestoneAchieved(row, readinessColumn)).length

    const countActivated = (data: Row[]) =>
      data.filter((row) => isMilestoneAchieved(row, activatedColumn)).length

    if (variant === "tlp" && providedStats) {
      return {
        totalSites: providedStats.totalSites ?? rows.length,
        crfi: providedStats.crfi ?? 0,
        rfi: providedStats.rfi ?? 0,
        construction: providedStats.construction ?? 0,
        rfc: providedStats.rfc ?? 0,
        sitac: providedStats.sitac ?? 0,
        searching: providedStats.searching ?? 0,
        returnCount: providedStats.returnCount ?? 0,
      }
    }

    if (variant === "tlp") {
      const statusCounts = rows.reduce(
        (acc, row) => {
          const siteStatus = normalizeSiteStatus(row.site_status)
          switch (siteStatus) {
            case "CRFI":
              acc.crfi += 1
              break
            case "RFI":
              acc.rfi += 1
              break
            case "CONSTRUCTION":
              acc.construction += 1
              break
            case "RFC":
              acc.rfc += 1
              break
            case "SITAC":
              acc.sitac += 1
              break
            case "SEARCHING":
              acc.searching += 1
              break
            case "RETURN":
              acc.returnCount += 1
              break
            default:
              break
          }
          return acc
        },
        { crfi: 0, rfi: 0, construction: 0, rfc: 0, sitac: 0, searching: 0, returnCount: 0 }
      )

      return {
        totalSites: rows.length,
        ...statusCounts,
      }
    }

    // OPTIMIZED: Gunakan stats dari API jika tersedia (sudah dihitung di database)
    // Fallback ke calculation dari rows jika stats tidak tersedia
    if (variant === "aop" && providedStats) {
      return {
        totalSites: providedStats.totalSites ?? rows.length,
        rfi: providedStats.rfi ?? rows.filter(row => row.ic_000010_af).length,
        crfi: providedStats.crfi ?? rows.filter(row => row.rfi_accepted).length,
        mos: providedStats.mos ?? rows.filter(row => row.mos_af).length,
        install: providedStats.install ?? rows.filter(row => row.ic_000040_af).length,
        rfs: providedStats.rfs ?? providedStats.activated ?? rows.filter(row => row.rfs_af).length,
        rfa: providedStats.rfa ?? rows.filter(row => row.ready_for_acpt_date).length,
        rfc: providedStats.rfc ?? rows.filter(row => row.rfc_approved).length,
        fatp: providedStats.fatp ?? rows.filter(row => row.fatp_accepted_af).length,
        patp: providedStats.patp ?? patpCount ?? rows.filter(row => row.patp_accepted_af).length,
        hotnews: providedStats.hotnews ?? rows.filter(row => row.hotnews_af).length,
        endorse: providedStats.endorse ?? rows.filter(row => row.endorse_af).length,
        pac: providedStats.pac ?? rows.filter(row => row.pac_accepted_af).length
      }
    }

    if (variant !== "aop" && providedStats) {
      return {
        totalSites: providedStats.totalSites ?? rows.length,
        caf: providedStats.caf ?? rows.filter(row => row.caf_approved).length,
        mos: providedStats.mos ?? rows.filter(row => row.mos_af).length,
        install: providedStats.install ?? rows.filter(row => row.ic_000040_af).length,
        readiness: providedStats.readiness ?? countReadiness(rows),
        activated: providedStats.activated ?? providedStats.rfs ?? countActivated(rows),
        rfa: providedStats.rfa ?? rows.filter(row => row.ready_for_acpt_date).length,
        rfc: providedStats.rfc ?? rows.filter(row => row.rfc_approved).length,
        fatp: providedStats.fatp ?? rows.filter(row => row.fatp_accepted_af).length,
        patp: providedStats.patp ?? patpCount ?? rows.filter(row => row.patp_accepted_af).length,
        hotnews: providedStats.hotnews ?? rows.filter(row => row.hotnews_af).length,
        endorse: providedStats.endorse ?? rows.filter(row => row.endorse_af).length,
        pac: providedStats.pac ?? rows.filter(row => row.pac_accepted_af).length
      }
    }
    
    const totalSites = rows.length
    
    if (variant === "aop") {
      // AOP variant metrics (fallback calculation jika stats tidak tersedia)
      const rfi = rows.filter(row => row.ic_000010_af).length
      const crfi = rows.filter(row => row.rfi_accepted).length
      const mos = rows.filter(row => row.mos_af).length
      const install = rows.filter(row => row.ic_000040_af).length
      const rfs = rows.filter(row => row.rfs_af).length
      const rfa = rows.filter(row => row.ready_for_acpt_date).length
      const rfc = rows.filter(row => row.rfc_approved).length
      const fatp = rows.filter(row => row.fatp_accepted_af).length
      const patp = patpCount > 0 ? patpCount : rows.filter(row => row.patp_accepted_af).length
      const hotnews = rows.filter(row => row.hotnews_af).length
      const endorse = rows.filter(row => row.endorse_af).length
      const pac = rows.filter(row => row.pac_accepted_af).length

      return {
        totalSites,
        rfi,
        crfi,
        mos,
        install,
        rfs,
        rfa,
        rfc,
        fatp,
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
    const readiness = countReadiness(rows)
    const activated = countActivated(rows)
    const rfa = rows.filter(row => row.ready_for_acpt_date).length
    const rfc = rows.filter(row => row.rfc_approved).length
    const fatp = rows.filter(row => row.fatp_accepted_af).length
    const hotnews = rows.filter(row => row.hotnews_af).length
    const endorse = rows.filter(row => row.endorse_af).length
    const pac = rows.filter(row => row.pac_accepted_af).length
    // Use patpCount from props if provided, otherwise calculate from rows
    const patp = patpCount > 0 ? patpCount : rows.filter(row => row.patp_accepted_af).length

    return {
      totalSites,
      caf,
      mos,
      install,
      readiness,
      activated,
      rfa,
      rfc,
      fatp,
      patp,
      hotnews,
      endorse,
      pac
    }
    }
  }, [rows, patpCount, variant, providedStats, readinessColumn, activatedColumn])

  const metricConfig = useMemo(() => {
    const base =
      variant === "aop" ? AOP_METRIC_CONFIG : variant === "tlp" ? TLP_METRIC_CONFIG : DEFAULT_METRIC_CONFIG
    if (!milestoneFields || variant !== "default") return base
    return base.map((metric) => {
      if (metric.key === "readiness") return { ...metric, label: milestoneFields.readinessLabel }
      if (metric.key === "activated") return { ...metric, label: milestoneFields.activatedLabel }
      return metric
    })
  }, [variant, milestoneFields])

  const metrics: MetricMap =
    variant === "tlp"
      ? {
          crfi: stats.crfi ?? 0,
          rfi: stats.rfi ?? 0,
          construction: stats.construction ?? 0,
          rfc: stats.rfc ?? 0,
          sitac: stats.sitac ?? 0,
          searching: stats.searching ?? 0,
          returnCount: stats.returnCount ?? 0,
        }
      : variant === "aop"
        ? {
            rfi: stats.rfi!,
            crfi: stats.crfi!,
            mos: stats.mos,
            install: stats.install,
            rfs: stats.rfs!,
            rfa: stats.rfa ?? 0,
            rfc: stats.rfc,
            fatp: stats.fatp ?? 0,
            patp: stats.patp,
            hotnews: stats.hotnews,
            endorse: stats.endorse,
            pac: stats.pac,
          }
        : {
            caf: stats.caf!,
            mos: stats.mos,
            install: stats.install,
            readiness: stats.readiness!,
            activated: stats.activated!,
            rfa: stats.rfa ?? 0,
            rfc: stats.rfc,
            fatp: stats.fatp ?? 0,
            patp: stats.patp,
            hotnews: stats.hotnews,
            endorse: stats.endorse,
            pac: stats.pac,
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

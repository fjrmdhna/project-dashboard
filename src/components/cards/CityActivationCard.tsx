"use client"

import { useMemo } from "react"
import { MapPin, TrendingUp } from "lucide-react"
import { isMilestoneAchieved } from "@/lib/hermes-milestone-fields"

interface CityActivationRow {
  imp_ttp?: string | null
  [column: string]: unknown
}

interface CityActivationCardProps {
  rows?: CityActivationRow[]
  /** Milestone column that counts a site as active. NR 2600 uses activation_2600_af. */
  activatedColumn?: string
  className?: string
}

interface CityActivationItem {
  id: string
  cityName: string
  totalSites: number
  activatedSites: number
  activatedPct: number
}

function activationColor(pct: number) {
  if (pct < 50) return { bg: "bg-amber-500/20", text: "#F59E0B", border: "border-amber-500/30" }
  if (pct < 80) return { bg: "bg-yellow-500/20", text: "#EAB308", border: "border-yellow-500/30" }
  if (pct < 100) return { bg: "bg-lime-500/20", text: "#84CC16", border: "border-lime-500/30" }
  return { bg: "bg-green-500/20", text: "#22C55E", border: "border-green-500/30" }
}

function CityActivationItemRow({ cityName, activatedPct, totalSites, activatedSites }: Omit<CityActivationItem, "id">) {
  const color = activationColor(activatedPct)

  return (
    <div className={`flex items-center justify-between rounded-md border ${color.border} p-1.5 transition-all hover:bg-white/5 min-w-0`}>
      <div className="flex items-center flex-1 min-w-0">
        <div className={`${color.bg} p-1 rounded-md mr-2 flex-shrink-0`}>
          <MapPin className="h-2.5 w-2.5" style={{ color: color.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-semibold text-white truncate" title={cityName}>
            {cityName}
          </div>
          <div className="text-[7px] text-[#B0B7C3]">
            {activatedSites.toLocaleString("en-US")}/{totalSites.toLocaleString("en-US")} sites
          </div>
        </div>
      </div>
      <div className="ml-2 shrink-0 text-[10px] font-bold" style={{ color: color.text }}>
        {activatedPct.toFixed(1)}% act
      </div>
    </div>
  )
}

export function CityActivationCard({
  rows = [],
  activatedColumn = "activation_2600_af",
  className = "",
}: CityActivationCardProps) {
  const cities = useMemo(() => {
    const cityMap = new Map<string, { total: number; activated: number }>()

    for (const row of rows) {
      const cityName = typeof row.imp_ttp === "string" ? row.imp_ttp.trim() : ""
      if (!cityName) continue

      const current = cityMap.get(cityName) ?? { total: 0, activated: 0 }
      current.total += 1
      if (isMilestoneAchieved(row, activatedColumn)) current.activated += 1
      cityMap.set(cityName, current)
    }

    return Array.from(cityMap.entries())
      .map(([cityName, data]): CityActivationItem => ({
        id: cityName,
        cityName,
        totalSites: data.total,
        activatedSites: data.activated,
        activatedPct: data.total > 0 ? (data.activated / data.total) * 100 : 0,
      }))
      .sort(
        (a, b) =>
          b.activatedPct - a.activatedPct ||
          b.totalSites - a.totalSites ||
          a.cityName.localeCompare(b.cityName)
      )
  }, [rows, activatedColumn])

  return (
    <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 w-full h-full min-h-0 flex flex-col text-white min-w-0 p-1 ${className}`}>
      <div className="mb-1 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="rounded-sm bg-indigo-500/20 p-0.5">
            <TrendingUp className="h-2.5 w-2.5 text-indigo-400" />
          </div>
          <div className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-300">
            CITY ACTIVATION
          </div>
        </div>
        <div className="flex items-center rounded-sm bg-indigo-500/10 px-1.5 py-0.5">
          <div className="mr-1 text-[7px] text-indigo-300">Total:</div>
          <div className="text-xs font-bold text-white">{cities.length}</div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
        role="list"
        aria-label="City activation"
      >
        {cities.length === 0 ? (
          <div className="flex h-full items-center justify-center px-2 text-center text-[8px] text-white/50">
            No city data
          </div>
        ) : (
          <div className="space-y-1">
            {cities.map((city) => (
              <div key={city.id} role="listitem">
                <CityActivationItemRow
                  cityName={city.cityName}
                  activatedPct={city.activatedPct}
                  totalSites={city.totalSites}
                  activatedSites={city.activatedSites}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

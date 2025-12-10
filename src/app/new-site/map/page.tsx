"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowLeft, Crosshair, Map } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { FilterBar, type FilterValue } from "@/components/filters/FilterBar"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import type { StatusLabel } from "@/components/maps/Hermes5GMap"
import { NEW_SITE_DASHBOARD_ROWS, NEW_SITE_INITIAL_FILTER } from "@/data/aop-dashboard"
import { deriveNewSiteStatus, filterNewSiteRows, toHermesMapPoints } from "@/lib/aop-utils"

const Hermes5GMap = dynamic(() => import("@/components/maps/Hermes5GMap"), { ssr: false })

const STATUS_COLORS: Record<StatusLabel, string> = {
  ACTIVE: "#22C55E",
  READY: "#38BDF8",
  RFI: "#FACC15",
  SOW: "#F97316"
}

const STATUS_COPY: Record<StatusLabel, string> = {
  ACTIVE: "Activated",
  READY: "Ready",
  RFI: "RFI",
  SOW: "SOW"
}

export default function NewSiteMapPage() {
  const [filterValue, setFilterValue] = useState<FilterValue>(NEW_SITE_INITIAL_FILTER)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const filteredRows = useMemo(
    () => filterNewSiteRows(NEW_SITE_DASHBOARD_ROWS, filterValue),
    [filterValue]
  )

  useEffect(() => {
    if (!filteredRows.length) {
      if (selectedKey !== null) {
        setSelectedKey(null)
      }
      return
    }

    const exists = filteredRows.some(row => row.system_key === selectedKey)
    if (!exists) {
      setSelectedKey(filteredRows[0].system_key)
    }
  }, [filteredRows, selectedKey])

  const statusCounts = useMemo(() => {
    return filteredRows.reduce<Record<StatusLabel, number>>(
      (acc, row) => {
        const status = deriveNewSiteStatus(row)
        acc[status] += 1
        return acc
      },
      { ACTIVE: 0, READY: 0, RFI: 0, SOW: 0 }
    )
  }, [filteredRows])

  const mapPoints = useMemo(() => toHermesMapPoints(filteredRows), [filteredRows])

  const selectedRow = useMemo(
    () => filteredRows.find(row => row.system_key === selectedKey) ?? null,
    [filteredRows, selectedKey]
  )

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
    []
  )

  const handleFilterChange = (value: FilterValue) => {
    setFilterValue(value)
  }

  const handleFilterReset = () => {
    setFilterValue(NEW_SITE_INITIAL_FILTER)
  }

  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 lg:px-8">
        <div className="space-y-4">
          <ProgramHeader title="New Site Deployment Map" dateLabel={formattedDate} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/60">
              Track readiness and activation progress per city, then drill into city-level details for sequencing.
            </p>
            <Link
              href="/new-site"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-[#0F1630]/75 p-4 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">
                      <Map className="h-3 w-3" />
                      Live Coverage
                    </div>
                    <h2 className="mt-2 text-xl font-semibold">Network Activation Map</h2>
                    <p className="text-sm text-white/60">
                      Apply filters to focus on a vendor, wave, or nano cluster, then inspect markers on the map.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                      <div key={status} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {STATUS_COPY[status as StatusLabel]}
                      </div>
                    ))}
                  </div>
                </div>
                <FilterBar
                  value={filterValue}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                  variant="newSite"
                  endpoint="/api/new-site/filters"
                />
              </div>

              <div className="h-[520px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050B1B]/40">
                {mapPoints.length ? (
                  <Hermes5GMap points={mapPoints} colors={STATUS_COLORS} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-white/60">
                    <Crosshair className="h-6 w-6 text-white/20" />
                    No sites match the current filters.
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-[#0C132A]/90 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Status Overview</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                  {filteredRows.length} Sites
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(Object.keys(STATUS_COLORS) as StatusLabel[]).map(status => (
                  <div
                    key={status}
                    className="rounded-2xl border border-white/5 bg-white/5 p-3 text-white"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                      {STATUS_COPY[status]}
                    </p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: STATUS_COLORS[status] }}>
                      {statusCounts[status]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0C132A]/90 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">City Focus</h3>
                <span className="text-xs text-white/50">Click a city to inspect</span>
              </div>
              <div className="mt-4 flex max-h-[240px] flex-col gap-2 overflow-y-auto pr-1">
                {filteredRows.map(row => {
                  const status = deriveNewSiteStatus(row)
                  const isSelected = row.system_key === selectedKey
                  return (
                    <button
                      key={row.system_key}
                      onClick={() => setSelectedKey(row.system_key)}
                      className={`flex flex-col rounded-2xl border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-white/40 bg-white/10"
                          : "border-white/5 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
                        <span>{row.imp_ttp ?? "Undefined"}</span>
                        <span style={{ color: STATUS_COLORS[status] }}>{STATUS_COPY[status]}</span>
                      </div>
                      <p className="text-sm font-semibold">{row.vendor_name}</p>
                      <p className="text-xs text-white/60">{row.program_report}</p>
                    </button>
                  )
                })}
                {!filteredRows.length && (
                  <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/50">
                    No city available under the selected filter set.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0C132A]/90 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-blue-500/20 p-2">
                  <Map className="h-4 w-4 text-blue-200" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">City Deployment Detail</h3>
                  <p className="text-xs text-white/50">Latest milestone snapshot for the selected city.</p>
                </div>
              </div>

              {selectedRow ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">System Key</p>
                    <p className="text-lg font-semibold">{selectedRow.system_key}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Vendor" value={selectedRow.vendor_name} />
                    <DetailItem label="Nano Cluster" value={selectedRow.nano_cluster} />
                    <DetailItem label="CAF Approved" value={selectedRow.caf_approved} />
                    <DetailItem label="MOS Actual" value={selectedRow.mos_af} />
                    <DetailItem label="Integration Actual" value={selectedRow.imp_integ_af} />
                    <DetailItem label="Activation Forecast" value={selectedRow.mocn_activation_forecast} />
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/20 p-3 text-xs text-white/70">
                    <p className="font-semibold uppercase tracking-[0.2em] text-white/60">Next Action</p>
                    <p className="text-sm">
                      {selectedRow.rfs_af
                        ? "Activation completed and ready for performance handshake."
                        : selectedRow.imp_integ_af
                          ? "Awaiting commercial activation slot; align with MO team."
                          : "Complete readiness gates before booking activation window."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/60">
                  Select a city from the list to view milestone details.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white/90">{value ?? "—"}</p>
    </div>
  )
}

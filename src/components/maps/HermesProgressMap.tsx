"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet"
import L, { type DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"

import { Row } from "@/components/cards/MatrixStatsCard"

const STAGE_CONFIG = {
  SOW: {
    label: "SOW (Total Sites)",
    color: "#0ea5e9",
    description: "Total site terdaftar"
  },
  RFI: {
    label: "RFI / CAF",
    color: "#f97316",
    description: "Site dengan CAF"
  },
  READY: {
    label: "Readiness",
    color: "#facc15",
    description: "Site siap aktif"
  },
  ACTIVE: {
    label: "Active",
    color: "#22c55e",
    description: "Site sudah aktif"
  }
} as const

type Stage = keyof typeof STAGE_CONFIG

const STAGE_PRIORITY: Stage[] = ["ACTIVE", "READY", "RFI", "SOW"]

const DEFAULT_BOUNDS: LatLngBoundsExpression = [
  [-11, 95],
  [6.5, 141]
]

const DEFAULT_CENTER: LatLngTuple = [-2, 117]

interface HermesProgressMapProps {
  rows: Row[]
  isLoading?: boolean
}

type MarkerDatum = {
  id: string
  position: LatLngTuple
  stage: Stage
  vendor?: string
  program?: string
}

function parseCoordinate(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getStage(row: Row): Stage {
  if (row.rfs_af) {
    return "ACTIVE"
  }
  if (row.imp_integ_af) {
    return "READY"
  }
  if (row.caf_approved) {
    return "RFI"
  }
  return "SOW"
}

export default function HermesProgressMap({ rows, isLoading = false }: HermesProgressMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterGroupRef = useRef<any>(null)

  const stageIcons = useMemo(() => {
    return STAGE_PRIORITY.reduce((acc, stage) => {
      const color = STAGE_CONFIG[stage].color
      const icon = L.divIcon({
        className: `hermes-map-marker hermes-stage-${stage.toLowerCase()}`,
        html: `<span style="
          display:flex;
          width:12px;
          height:12px;
          border-radius:50%;
          border:1.5px solid rgba(255,255,255,0.6);
          background:${color};
          box-shadow:0 0 8px rgba(0,0,0,0.45);
        "></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
      acc[stage] = icon as DivIcon
      return acc
    }, {} as Record<Stage, DivIcon>)
  }, [])

  const { markers, totals, bounds } = useMemo(() => {
    const totals: Record<Stage, number> = {
      SOW: 0,
      RFI: 0,
      READY: 0,
      ACTIVE: 0
    }

    const latLngs: LatLngTuple[] = []
    const markers: MarkerDatum[] = []

    for (const row of rows) {
      const lat = parseCoordinate(row.lat ?? null)
      const long = parseCoordinate(row.long ?? null)

      const stage = getStage(row)
      totals.SOW += 1
      totals[stage] += 1

      if (lat === null || long === null) {
        continue
      }

      markers.push({
        id: row.system_key,
        position: [lat, long],
        stage,
        vendor: row.vendor_name ?? undefined,
        program: row.program_report ?? undefined
      })
      latLngs.push([lat, long])
    }

    const bounds = latLngs.length > 0 ? L.latLngBounds(latLngs) : null

    return { markers, totals, bounds }
  }, [rows])

  const createClusterIcon = useCallback((cluster: any) => {
    const childMarkers = cluster.getAllChildMarkers() as Array<L.Marker>
    const stageCounts: Record<Stage, number> = {
      SOW: 0,
      RFI: 0,
      READY: 0,
      ACTIVE: 0
    }

    childMarkers.forEach((marker) => {
      const className = marker.options.icon?.options?.className as string | undefined
      const match = className?.match(/hermes-stage-([a-z]+)/)
      const stage = match ? (match[1].toUpperCase() as Stage) : "SOW"
      stageCounts[stage] += 1
    })

    let dominantStage: Stage = "SOW"
    let dominantCount = -1
    for (const stage of STAGE_PRIORITY) {
      const count = stageCounts[stage]
      if (count > dominantCount) {
        dominantStage = stage
        dominantCount = count
      }
    }

    return L.divIcon({
      html: `<div class="hermes-cluster" style="background:${STAGE_CONFIG[dominantStage].color}">
        <span>${cluster.getChildCount()}</span>
      </div>`,
      className: "hermes-cluster-wrapper",
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
      attributionControl: false
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 4,
      maxZoom: 18
    }).addTo(map)

    L.control.zoom({ position: "topleft" }).addTo(map)

    map.setView(DEFAULT_CENTER, 5)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (clusterGroupRef.current) {
      clusterGroupRef.current.clearLayers()
      map.removeLayer(clusterGroupRef.current)
    }

    const clusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      iconCreateFunction: createClusterIcon,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      polygonOptions: { color: "#38bdf8", weight: 1, opacity: 0.35 }
    })

    markers.forEach((marker) => {
      const leafletMarker = L.marker(marker.position, { icon: stageIcons[marker.stage] })

      const tooltip = `
        <div style="display:flex; flex-direction:column; gap:4px; font-size:11px; line-height:1.2; color:#f8fafc;">
          <div style="font-weight:600; color:#fff;">${marker.id}</div>
          <div style="display:flex; align-items:center; gap:6px; color:rgba(255,255,255,0.85);">
            <span style="display:inline-flex; width:8px; height:8px; border-radius:50%; background:${STAGE_CONFIG[marker.stage].color};"></span>
            <span>${STAGE_CONFIG[marker.stage].label}</span>
          </div>
          ${marker.vendor ? `<div style="color:rgba(255,255,255,0.75);">Vendor: ${marker.vendor}</div>` : ""}
          ${marker.program ? `<div style="color:rgba(255,255,255,0.75);">Program: ${marker.program}</div>` : ""}
        </div>
      `

      leafletMarker.bindTooltip(tooltip, {
        direction: "top",
        offset: L.point(0, -12),
        opacity: 1,
        sticky: true
      })

      clusterGroup.addLayer(leafletMarker)
    })

    clusterGroup.addTo(map)
    clusterGroupRef.current = clusterGroup

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 })
    } else {
      map.setView(DEFAULT_CENTER, 5)
    }

    setTimeout(() => {
      map.invalidateSize()
    }, 120)
  }, [markers, bounds, stageIcons, createClusterIcon])

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-[#0b1431] text-white">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
        <div>
          <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
            Indonesia Progress Map
          </h3>
          <p className="text-xs text-white/65">Sebaran status Hermes berdasarkan lokasi TTP</p>
        </div>
        <div className="text-xs text-white/60">Total Site: {totals.SOW.toLocaleString("id-ID")}</div>
      </header>

      <div className="relative">
        <div ref={containerRef} className="h-[560px] w-full rounded-b-2xl overflow-hidden" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-b-2xl bg-[#0b1431]/75 backdrop-blur-sm text-sm font-medium">
            Memuat data peta...
          </div>
        )}

        {!isLoading && markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded-b-2xl bg-[#0b1431]/75 backdrop-blur-sm text-sm text-white/70">
            Tidak ada data koordinat untuk filter saat ini
          </div>
        )}

        <aside className="absolute right-4 top-6 z-[400] w-48 rounded-xl bg-[#0f1c3f]/90 p-4 shadow-lg shadow-black/40">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Legend</h4>
          <div className="mt-3 space-y-3">
            {STAGE_PRIORITY.map((stage) => (
              <div key={stage} className="flex items-start justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: STAGE_CONFIG[stage].color }}
                  />
                  <span className="text-white/80">{STAGE_CONFIG[stage].label}</span>
                </div>
                <span className="font-semibold text-white/90">{totals[stage].toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef } from 'react'
import L, { type Map as LeafletMap, type LayerGroup, type CircleMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type StatusLabel = 'SOW' | 'RFI' | 'READY' | 'ACTIVE' | 'INSTALL' | 'ON_AIR'

export interface HermesMapPoint {
  id: string
  status: StatusLabel
  lat: number
  long: number
  vendorName?: string | null
  siteName?: string | null
  siteId?: string | null
  programReport?: string | null
  impTtp?: string | null
  issueCategory?: string | null
  nanoCluster?: string | null
  isExcluded?: boolean
}

export interface Hermes5GMapProps {
  points: HermesMapPoint[]
  colors: Record<StatusLabel, string>
  loading?: boolean
  error?: string | null
}

const DEFAULT_CENTER: [number, number] = [-2.5, 118]
const DEFAULT_ZOOM = 5
const MAX_ZOOM = 15
const EXCLUDED_COLOR = '#6B7280'

function formatPopup(point: HermesMapPoint) {
  const rows: string[] = []

  rows.push(`<strong>Status: ${point.status}</strong>`)

  if (point.siteId) {
    rows.push(`Site ID: ${point.siteId}`)
  }

  if (point.siteName) {
    rows.push(`Site Name: ${point.siteName}`)
  }

  rows.push(`System Key: ${point.id}`)

  if (point.vendorName) {
    rows.push(`Vendor: ${point.vendorName}`)
  }

  if (point.programReport) {
    rows.push(`Program: ${point.programReport}`)
  }

  if (point.impTtp) {
    rows.push(`IMP TTP: ${point.impTtp}`)
  }

  if (point.nanoCluster) {
    rows.push(`Nano Cluster: ${point.nanoCluster}`)
  }

  rows.push(`Issue: ${point.issueCategory ? point.issueCategory : 'No issue recorded'}`)

  const latText = point.lat.toFixed(4)
  const longText = point.long.toFixed(4)
  const gmaps = `https://www.google.com/maps?q=${point.lat},${point.long}`
  rows.push(`Location: <a href="${gmaps}" target="_blank" rel="noopener noreferrer">${latText}, ${longText}</a>`)

  return rows.join('<br />')
}

export function Hermes5GMap({ points, colors, loading = false, error = null }: Hermes5GMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)

  const orderedPoints = useMemo(() => {
    const order: StatusLabel[] = ['ACTIVE', 'READY', 'RFI', 'SOW']
    const rank = order.reduce<Record<StatusLabel, number>>((acc, status, index) => {
      acc[status] = index
      return acc
    }, {} as Record<StatusLabel, number>)
    return [...points].sort((a, b) => {
      if (a.isExcluded && !b.isExcluded) {
        return -1
      }
      if (!a.isExcluded && b.isExcluded) {
        return 1
      }
      return (rank[a.status] ?? 0) - (rank[b.status] ?? 0)
    })
  }, [points])

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: MAX_ZOOM,
      worldCopyJump: true,
      attributionControl: false
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: MAX_ZOOM,
      detectRetina: true
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  const palette = useMemo(
    () => ({
      ACTIVE: colors.ACTIVE ?? '#22C55E',  // Hijau untuk ACTIVE
      READY: colors.READY ?? '#2563EB',    // Biru untuk READY
      RFI: colors.RFI ?? '#FACC15',        // Kuning untuk RFI
      SOW: colors.SOW ?? '#EF4444',        // Merah untuk SOW
      INSTALL: colors.INSTALL ?? '#8B5CF6', // Ungu untuk INSTALL
      ON_AIR: colors.ON_AIR ?? '#06B6D4'   // Cyan untuk ON_AIR
    }),
    [colors]
  )

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current

    if (!map || !layer) {
      return
    }

    layer.clearLayers()

    if (!orderedPoints.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }

    const bounds = L.latLngBounds([])

    orderedPoints.forEach((point) => {
      // Validate coordinates are within valid ranges
      // General valid range: Lat -90 to 90, Long -180 to 180
      const isValidLat = typeof point.lat === 'number' && point.lat >= -90 && point.lat <= 90
      const isValidLong = typeof point.long === 'number' && point.long >= -180 && point.long <= 180
      
      if (!isValidLat || !isValidLong) {
        return // Skip invalid coordinates
      }

      const color = point.isExcluded ? EXCLUDED_COLOR : (palette[point.status] ?? EXCLUDED_COLOR)
      const marker: CircleMarker = L.circleMarker([point.lat, point.long], {
        radius: 4,
        color,
        fillColor: color,
        fillOpacity: point.isExcluded ? 0.8 : 0.85,
        opacity: point.isExcluded ? 0.8 : 0.9,
        weight: 1,
        stroke: false
      })

      marker.bindPopup(formatPopup(point))
      marker.addTo(layer)
      bounds.extend(marker.getLatLng())
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08))
    }
  }, [orderedPoints, palette])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {(loading || error) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0F1B3D]/70 text-white text-sm">
          {loading ? 'Loading map data...' : error}
        </div>
      )}
    </div>
  )
}

export default Hermes5GMap

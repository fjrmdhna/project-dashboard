"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import L, { type Map as LeafletMap, type LayerGroup, type CircleMarker, type Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Center coordinates untuk Indonesia
const INDONESIA_CENTER: [number, number] = [-2.5, 118]
const INDONESIA_ZOOM = 5
const MIN_ZOOM = 4
const MAX_ZOOM = 15
const DETAIL_ZOOM_THRESHOLD = 6
const numberFormatter = new Intl.NumberFormat('id-ID')
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function getCircleRadius(zoom: number): number {
  const minRadius = 3.25
  const maxRadius = 10
  const ratio = clamp01((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM))
  return minRadius + (maxRadius - minRadius) * ratio
}

function getBadgeScale(zoom: number): number {
  const minScale = 0.55
  const maxScale = 1
  const ratio = clamp01((zoom - MIN_ZOOM) / ((DETAIL_ZOOM_THRESHOLD + 1) - MIN_ZOOM))
  return minScale + (maxScale - minScale) * ratio
}

function getDetailScale(zoom: number): number {
  const minScale = 0.75
  const maxScale = 1.05
  const ratio = clamp01((zoom - DETAIL_ZOOM_THRESHOLD) / (MAX_ZOOM - DETAIL_ZOOM_THRESHOLD))
  return minScale + (maxScale - minScale) * ratio
}

// Interface untuk data kota
export interface CityData {
  id: string
  name: string
  lat: number
  lng: number
  sow: number
  readiness: number
  activated: number
  plan?: string
}

type CityOverlay = CityData & {
  readinessPct: number
  activatedPct: number
  readinessColor: string
  activatedColor: string
  layout: CityLayout
}

type CityLayout = {
  align: 'left' | 'right' | 'center'
  offsetX: number
  offsetY: number
}

type CityLayoutConfig = Partial<CityLayout>

const CITY_LAYOUT_OVERRIDES: Record<string, CityLayoutConfig> = {
  'JAKARTA': { offsetX: -30, offsetY: 16, align: 'left' },
  'BANDUNG': { offsetX: 28, offsetY: 12, align: 'right' },
  'SURABAYA': { offsetX: 32, offsetY: 10, align: 'right' },
  'SEMARANG': { offsetX: -32, offsetY: 6, align: 'left' },
  'YOGYAKARTA': { offsetX: -32, offsetY: -6, align: 'left' },
  'PALEMBANG': { offsetX: 18, offsetY: -8, align: 'right' },
  'MEDAN': { offsetX: 22, offsetY: -10, align: 'right' },
  'BATAM': { offsetX: 18, offsetY: -4, align: 'right' },
  'MAKASSAR': { offsetX: -26, offsetY: 12, align: 'left' },
  'MALANG': { offsetX: -28, offsetY: -12, align: 'left' }
}

function resolveCityLayout(name: string): CityLayout {
  const key = name.trim().toUpperCase()
  const config = CITY_LAYOUT_OVERRIDES[key] ?? {}
  return {
    align: config.align ?? 'center',
    offsetX: config.offsetX ?? 0,
    offsetY: config.offsetY ?? 0
  }
}

export interface IndonesiaMapProps {
  className?: string
  height?: string
  cities?: CityData[]
  loading?: boolean
}

// Function untuk format info box HTML
function formatInfoBox(city: CityData): string {
  return `
    <div style="
      background: linear-gradient(135deg, #ff6b9d 0%, #ff8fab 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 180px;
      max-width: 250px;
    ">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px; text-transform: uppercase;">
        ${city.name}
      </div>
      <div style="margin-bottom: 4px;">
        <strong>SOW:</strong> ${city.sow}
      </div>
      <div style="margin-bottom: 4px;">
        <strong>Readiness:</strong> ${city.readiness}
      </div>
      <div style="margin-bottom: 4px;">
        <strong>Activated:</strong> ${city.activated}
      </div>
      <div>
        <strong>Plan:</strong> ${city.plan || 'TBD'}
      </div>
    </div>
  `
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getStatusColor(percent: number): string {
  if (percent >= 85) return '#0ea5e9'
  if (percent >= 65) return '#22c55e'
  if (percent >= 40) return '#f59e0b'
  return '#ef4444'
}

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function buildOverlayHtml(
  city: CityData,
  readinessPct: number,
  activatedPct: number,
  readinessColor: string,
  activatedColor: string,
  layout: CityLayout,
  scale: number
): string {
  const planText = city.plan || 'Plan TBD'
  const alignClass = `city-overlay--${layout.align}`
  const offsetStyle = `--city-offset-x:${layout.offsetX}px; --city-offset-y:${layout.offsetY}px; --city-scale:${scale};`

  return `
    <div class="city-overlay ${alignClass}" style="${offsetStyle}">
      <div class="city-overlay__pin">
        <div class="city-overlay__badge" style="background:${readinessColor};">
          ${readinessPct}%
        </div>
        <div class="city-overlay__stem"></div>
      </div>
      <div class="city-overlay__card">
        <div class="city-overlay__header">
          <span class="city-overlay__name">${city.name}</span>
          <span class="city-overlay__plan">${planText}</span>
        </div>
        <div class="city-overlay__stats">
          <div class="city-overlay__stats-item">
            <span>SOW</span>
            <strong>${formatNumber(city.sow)}</strong>
          </div>
          <div class="city-overlay__stats-item">
            <span>Readiness</span>
            <strong>${formatNumber(city.readiness)}</strong>
          </div>
          <div class="city-overlay__stats-item">
            <span>Activated</span>
            <strong>${formatNumber(city.activated)}</strong>
          </div>
        </div>
        <div class="city-overlay__progress">
          <div class="city-overlay__progress-label">
            <span>Readiness coverage</span>
            <span>${readinessPct}%</span>
          </div>
          <div class="city-overlay__progress-track">
            <div class="city-overlay__progress-fill" style="width:${readinessPct}%; background:${readinessColor};"></div>
          </div>
          <div class="city-overlay__progress-label">
            <span>Activation</span>
            <span>${activatedPct}%</span>
          </div>
          <div class="city-overlay__progress-track">
            <div class="city-overlay__progress-fill" style="width:${activatedPct}%; background:${activatedColor};"></div>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildBadgeHtml(
  city: CityData,
  readinessPct: number,
  readinessColor: string,
  layout: CityLayout,
  scale: number
): string {
  const offsetStyle = `--city-offset-x:${layout.offsetX}px; --city-offset-y:${layout.offsetY}px; --city-scale:${scale};`
  const alignClass = `city-badge--${layout.align}`

  return `
    <div class="city-badge ${alignClass}" style="${offsetStyle}">
      <span class="city-badge__value" style="background:${readinessColor};">
        ${readinessPct}%
      </span>
      <span class="city-badge__label">${city.name}</span>
    </div>
  `
}

export function IndonesiaMap({ 
  className = '', 
  height = '100%',
  cities = [],
  loading = false
}: IndonesiaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersLayerRef = useRef<LayerGroup | null>(null)
  const overlayLayerRef = useRef<LayerGroup | null>(null)
  const [activeCityId, setActiveCityId] = useState<string | null>(null)
  const computedCities = useMemo<CityOverlay[]>(() => {
    if (!cities || !cities.length) {
      return []
    }

    return cities.map((city) => {
      const readinessPct = city.sow ? clampPercentage((city.readiness / city.sow) * 100) : 0
      const activatedPct = city.sow ? clampPercentage((city.activated / city.sow) * 100) : 0
      const readinessColor = getStatusColor(readinessPct)
      const activatedColor = getStatusColor(activatedPct)
      const layout = resolveCityLayout(city.name)

      return {
        ...city,
        readinessPct,
        activatedPct,
        readinessColor,
        activatedColor,
        layout
      }
    })
  }, [cities])

  useEffect(() => {
    if (activeCityId && !computedCities.some(city => city.id === activeCityId)) {
      setActiveCityId(null)
    }
  }, [activeCityId, computedCities])

  useEffect(() => {
    // Prevent multiple initializations
    if (mapRef.current || !containerRef.current) {
      return
    }

    // Initialize map with white background
    const map = L.map(containerRef.current, {
      center: INDONESIA_CENTER,
      zoom: INDONESIA_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      worldCopyJump: true,
      attributionControl: false, // Hide attribution for cleaner look
      zoomControl: true,
      // Set background color to white
      zoomAnimation: true,
      fadeAnimation: true,
    })

    const overlayPane = map.createPane('city-overlay-pane')
    overlayPane.style.zIndex = '650'
    overlayPane.classList.add('city-overlay-pane')

    // Add CartoDB Positron tile layer (grayscale style)
    // This provides a clean, minimal grayscale map perfect for administrative boundaries
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: MAX_ZOOM,
      detectRetina: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(map)

    // Set white background and apply grayscale filter
    const mapContainer = containerRef.current
    if (mapContainer) {
      mapContainer.style.backgroundColor = '#ffffff'
      
      // Apply grayscale filter to map tiles using CSS
      const styleId = 'indonesia-map-grayscale-style'
      let styleElement = document.getElementById(styleId) as HTMLStyleElement
      
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }

      styleElement.textContent = `
          .indonesia-map-container .leaflet-container {
            background-color: #ffffff !important;
          }
          .indonesia-map-container .leaflet-tile-container img {
            filter: grayscale(100%) contrast(1.05) brightness(1.02);
          }
          .indonesia-map-container .leaflet-control-attribution {
            background-color: rgba(255, 255, 255, 0.8) !important;
            color: #666 !important;
            font-size: 10px;
          }
          .city-info-popup .leaflet-popup-content-wrapper {
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .city-info-popup .leaflet-popup-content {
            margin: 0 !important;
          }
          .city-info-popup .leaflet-popup-tip {
            background: linear-gradient(135deg, #ff6b9d 0%, #ff8fab 100%) !important;
          }
          .city-overlay-pane {
            pointer-events: none;
          }
          .city-overlay-marker {
            pointer-events: none;
          }
          .city-overlay {
            --city-offset-x: 0px;
            --city-offset-y: 0px;
            --city-scale: 1;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            transform: translate(calc(-50% + var(--city-offset-x)), calc(-100% + var(--city-offset-y)))
              scale(var(--city-scale));
            transform-origin: bottom center;
          }
          .city-overlay--left {
            align-items: flex-end;
          }
          .city-overlay--right {
            align-items: flex-start;
          }
          .city-overlay__pin {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .city-overlay__badge {
            min-width: 40px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            color: #fff;
            text-align: center;
            box-shadow: 0 8px 18px rgba(15, 22, 48, 0.35);
          }
          .city-overlay__stem {
            width: 2px;
            height: 32px;
            background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0));
          }
          .city-overlay__card {
            pointer-events: auto;
            background: rgba(255, 255, 255, 0.97);
            border-radius: 12px;
            padding: 12px 14px;
            min-width: 190px;
            max-width: 220px;
            color: #0f172a;
            border: 1px solid rgba(255,255,255,0.7);
            box-shadow: 0 25px 65px rgba(15, 27, 61, 0.22);
            backdrop-filter: blur(2px);
          }
          .city-overlay__header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 8px;
          }
          .city-overlay__name {
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
          }
          .city-overlay__plan {
            font-size: 10px;
            color: #475569;
            background: rgba(15, 22, 48, 0.05);
            border-radius: 999px;
            padding: 2px 8px;
            text-transform: uppercase;
          }
          .city-overlay__stats {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            margin-bottom: 10px;
          }
          .city-overlay__stats-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 11px;
            color: #475569;
          }
          .city-overlay__stats-item strong {
            color: #0f172a;
            font-size: 13px;
          }
          .city-overlay__progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #475569;
            margin-bottom: 4px;
          }
          .city-overlay__progress-track {
            width: 100%;
            height: 6px;
            background: rgba(148, 163, 184, 0.35);
            border-radius: 999px;
            overflow: hidden;
            margin-bottom: 8px;
          }
          .city-overlay__progress-fill {
            height: 100%;
            border-radius: 999px;
            transition: width 0.3s ease;
          }
          .city-overlay__card:hover {
            box-shadow: 0 35px 80px rgba(15, 22, 48, 0.28);
          }
          .city-badge {
            --city-offset-x: 0px;
            --city-offset-y: 0px;
            --city-scale: 1;
            pointer-events: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            transform: translate(calc(-50% + var(--city-offset-x)), calc(-100% + var(--city-offset-y)))
              scale(var(--city-scale));
            transform-origin: bottom center;
          }
          .city-badge--left {
            align-items: flex-end;
          }
          .city-badge--right {
            align-items: flex-start;
          }
          .city-badge__value {
            min-width: 32px;
            height: 32px;
            border-radius: 999px;
            color: #fff;
            font-weight: 700;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(15, 22, 48, 0.25);
          }
          .city-badge__label {
            background: rgba(15, 22, 48, 0.7);
            color: #f8fafc;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 2px 6px;
            border-radius: 999px;
            white-space: nowrap;
          }
        `
    }

    // Create layer group for markers
    markersLayerRef.current = L.layerGroup().addTo(map)
    overlayLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map

    // Handle window resize to ensure map renders correctly
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    }

    const handleMapClick = () => setActiveCityId(null)

    map.on('click', handleMapClick)
    window.addEventListener('resize', handleResize)

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize)
      map.off('click', handleMapClick)
      map.remove()
      mapRef.current = null
      markersLayerRef.current = null
      overlayLayerRef.current = null
    }
  }, [])

  const initialBoundsFitRef = useRef(false)

  // Add markers when cities or zoom states change
  useEffect(() => {
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    const overlayLayer = overlayLayerRef.current

    if (!map || !markersLayer || !overlayLayer) {
      return
    }

    const renderLayers = () => {
      markersLayer.clearLayers()
      overlayLayer.clearLayers()

      if (!computedCities.length || loading) {
        return
      }

      const zoomLevel = map.getZoom()
      const badgeScale = getBadgeScale(zoomLevel)
      const detailScale = getDetailScale(zoomLevel)
      const circleRadius = getCircleRadius(zoomLevel)

      computedCities.forEach((city) => {
        const location: [number, number] = [city.lat, city.lng]
        const circleMarker: CircleMarker = L.circleMarker(location, {
          radius: circleRadius,
          fillColor: city.readinessColor,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.95,
          opacity: 1
        })

        circleMarker.bindPopup(formatInfoBox(city), {
          className: 'city-info-popup',
          closeButton: true,
          autoPan: true,
          offset: [0, -10],
          maxWidth: 280
        })

        circleMarker.addTo(markersLayer)
      })

      const activeId = activeCityId

      computedCities.forEach((city) => {
        const location: [number, number] = [city.lat, city.lng]
        const isDetail = Boolean(activeId && city.id === activeId)
        const html = isDetail
          ? buildOverlayHtml(
              city,
              city.readinessPct,
              city.activatedPct,
              city.readinessColor,
              city.activatedColor,
              city.layout,
              detailScale
            )
          : buildBadgeHtml(city, city.readinessPct, city.readinessColor, city.layout, badgeScale)

        const overlayIcon = L.divIcon({
          className: `city-overlay-marker ${isDetail ? 'city-overlay-marker--detail' : 'city-overlay-marker--badge'}`,
          html,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })

        const overlayMarker: Marker = L.marker(location, {
          icon: overlayIcon,
          pane: 'city-overlay-pane',
          interactive: true,
          keyboard: false,
          riseOnHover: isDetail,
          bubblingMouseEvents: false
        })

        overlayMarker.addTo(overlayLayer)
        overlayMarker.on('click', (event) => {
          event.originalEvent?.stopPropagation?.()
          setActiveCityId((prev) => {
            const next = prev === city.id ? null : city.id
            if (next === city.id) {
              const targetZoom = Math.max(map.getZoom(), DETAIL_ZOOM_THRESHOLD)
              map.flyTo(location, targetZoom, { duration: 0.45 })
            }
            return next
          })
        })
      })
    }

    renderLayers()
    map.on('zoomend', renderLayers)

    if (!initialBoundsFitRef.current && computedCities.length) {
      const bounds = L.latLngBounds(
        computedCities.map(city => [city.lat, city.lng] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12))
        initialBoundsFitRef.current = true
      }
    }

    return () => {
      map.off('zoomend', renderLayers)
      markersLayer.clearLayers()
      overlayLayer.clearLayers()
    }
  }, [computedCities, loading, activeCityId])

  return (
    <div 
      className={`relative w-full bg-white indonesia-map-container ${className}`} 
      style={{ height, backgroundColor: '#ffffff' }}
    >
      <div 
        ref={containerRef} 
        className="h-full w-full rounded-2xl bg-white"
        style={{ 
          minHeight: '400px',
          backgroundColor: '#ffffff',
        }}
      />
    </div>
  )
}

export default IndonesiaMap

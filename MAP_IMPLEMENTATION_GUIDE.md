# Panduan Implementasi Map dengan React Leaflet

## Overview
Dokumentasi ini menjelaskan cara membuat map interaktif menggunakan React Leaflet dengan fitur-fitur canggih seperti clustering, filtering, dan optimasi performa.

## Dependencies yang Diperlukan

### 1. Package Dependencies
```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  "react-leaflet-cluster": "^2.1.0",
  "@types/leaflet": "^1.9.15"
}
```

### 2. CSS Dependencies
```css
import 'leaflet/dist/leaflet.css'
```

## Struktur Komponen

### 1. CardMap.tsx (Wrapper Component)
```typescript
import dynamic from 'next/dynamic'

export function CardMap() {
  const MapWithNoSSR = dynamic(() => import('@/app/components/SiteData/Map'), {
    ssr: false, // Disable SSR untuk komponen map
    loading: () => (
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <h3 className="text-lg font-medium mb-4">Site Locations</h3>
        <div className="h-[400px] w-full rounded-lg overflow-hidden flex items-center justify-center bg-gray-100">
          Loading map...
        </div>
      </div>
    )
  })

  return <MapWithNoSSR />
}
```

### 2. Map.tsx (Main Map Component)
Komponen utama yang menangani semua logika map.

## Implementasi Detail

### 1. Setup Dasar Map

#### Import Dependencies
```typescript
import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
```

#### Fix Marker Icons
```typescript
// Fix marker icon paths
const icon = L.icon({
  iconUrl: '/images/leaflet/marker-icon.png',
  iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
})
```

### 2. Custom Marker Functions

#### Circle Marker
```typescript
const createCircleMarker = (color: string, isSwapped: boolean = false) => {
  return L.divIcon({
    className: 'custom-circle-marker',
    html: `<div style="
      background-color: ${color};
      width: 8px;
      height: 8px;
      border-radius: 50%;
      opacity: ${isSwapped ? '1' : '0.6'};
    "></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  })
}
```

#### Cluster Icon
```typescript
const createClusterIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers()
  const firstMarker = markers[0]
  const markerColor = firstMarker.options.icon.options.html.match(/background-color: ([^;]+)/)[1]
  
  return L.divIcon({
    className: 'custom-cluster-marker',
    html: `<div style="
      background-color: ${markerColor};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
    ">${cluster.getChildCount()}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}
```

### 3. Color Management System

#### Color Generation
```typescript
const getUniqueColor = (value: string, index: number, type: string = '') => {
  const monthlyColors = [
    '#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA',
    '#00ACC1', '#FB8C00', '#D81B60', '#3949AB', '#00897B',
    '#7CB342', '#C0CA33', '#6D4C41', '#546E7A', '#5E35B1'
  ]

  const defaultColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#F1C40F', '#E74C3C',
    '#1ABC9C', '#2ECC71', '#E67E22', '#95A5A6', '#34495E'
  ]

  if (type === 'month') {
    return monthlyColors[index % monthlyColors.length]
  }

  return defaultColors[index % defaultColors.length]
}
```

#### Color Caching
```typescript
const colorCache: { [key: string]: { [key: string]: string } } = {
  city: {},
  mc: {},
  nano: {},
  scope: {},
  month: {}
}

const getCachedColor = (layerType: string, value: string, index: number) => {
  if (!colorCache[layerType][value]) {
    colorCache[layerType][value] = getUniqueColor(value, index, layerType)
  }
  return colorCache[layerType][value]
}
```

### 4. Performance Optimization

#### Throttle Functions
```typescript
const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): T => {
  let inThrottle: boolean
  return ((...args: Parameters<T>): ReturnType<T> => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
    return undefined as ReturnType<T>
  }) as T
}
```

#### Debounce Function
```typescript
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
```

#### Marker Optimization
```typescript
const getMarkerLimit = (zoom: number) => {
  if (zoom <= 5) return 100
  if (zoom <= 6) return 200
  if (zoom <= 7) return 400
  if (zoom <= 8) return 800
  if (zoom <= 9) return 1600
  return 3200
}
```

### 5. Map Container Setup

#### Basic MapContainer
```typescript
<MapContainer
  center={[-2.5489, 118.0149]} // Koordinat Indonesia
  zoom={5}
  className="h-[300px] lg:h-[600px] w-full rounded-xl"
  ref={setMap}
  preferCanvas={true}
  zoomAnimation={false}
  markerZoomAnimation={false}
  fadeAnimation={false}
  maxZoom={18}
  minZoom={5}
  zoomSnap={0.25}
  zoomDelta={0.25}
  renderer={L.canvas({ tolerance: 5 })}
>
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
</MapContainer>
```

### 6. Marker Implementation

#### Canvas-based Markers
```typescript
// Update canvas layer when data changes
useEffect(() => {
  if (!map) return
  if (displayMode === 'area') return
  if (!markerData.length) return
  
  // Remove existing layer group if exists
  if (markersLayerRef.current) {
    map.removeLayer(markersLayerRef.current)
  }

  // Create new layer group
  const layerGroup = L.layerGroup().addTo(map)
  markersLayerRef.current = layerGroup

  const canvas = L.canvas({ padding: 0.5, tolerance: 5 })
  canvasLayerRef.current = canvas

  markers.forEach(marker => {
    const leafletMarker = L.circleMarker([marker.lat, marker.lng], {
      radius: 3,
      fillColor: color,
      color: color,
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
      renderer: canvas
    })
    .addTo(layerGroup)
    .on('click', () => {
      // Popup content
      const popupContent = `
        <div class="text-xs">
          <p><strong>Site ID:</strong> ${marker.data.site_id}</p>
          <p><strong>Site Name:</strong> ${marker.data.site_name}</p>
          <p><strong>MC Cluster:</strong> ${marker.data.mc_cluster}</p>
          <p><strong>City:</strong> ${marker.data.dati_ii}</p>
          <p><strong>Status:</strong> ${status}</p>
        </div>
      `
      
      const popup = L.popup()
        .setLatLng([marker.lat, marker.lng])
        .setContent(popupContent)
      map.openPopup(popup)
    })
  })
}, [map, markerData, displayMode])
```

### 7. GeoJSON Implementation

#### GeoJSON Component
```typescript
const ClusterGeoJSON = React.memo(({ 
  geojsonData, 
  clusterSiteMap, 
  setGeoJsonLayerRef,
  map
}: { 
  geojsonData: any, 
  clusterSiteMap: Record<string, SiteData[]>,
  setGeoJsonLayerRef: (layer: L.GeoJSON | null) => void,
  map: L.Map | null
}) => {
  return (
    <GeoJSON
      data={geojsonData}
      ref={(layer) => {
        if (layer) {
          setGeoJsonLayerRef(layer);
          // Tooltip setup
          setTimeout(() => {
            if (layer && layer.eachLayer) {
              layer.eachLayer((subLayer: any) => {
                if (subLayer.feature && subLayer.feature.properties) {
                  const clusterName = subLayer.feature.properties.Final_Prio || '-';
                  
                  subLayer.bindTooltip(
                    `<div class="cluster-tooltip-content">${clusterName}</div>`,
                    {
                      sticky: true,
                      opacity: 1.0,
                      className: 'cluster-tooltip',
                      direction: 'auto',
                      permanent: false
                    }
                  );
                }
              });
            }
          }, 100);
        }
      }}
      style={featureArg => {
        const feature = featureArg as any
        if (!feature || !feature.properties) return {}
        const key = normalizeCluster(feature.properties.Final_Prio)
        const sites = clusterSiteMap[key] || []
        const hasSwapped = sites.some(site => site.cutover_af)
        return {
          color: hasSwapped ? '#EF5350' : '#42A5F5',
          weight: 3,
          fillOpacity: 0.8,
          fillColor: hasSwapped ? '#EF5350' : '#42A5F5',
        }
      }}
      onEachFeature={(featureArg, layer) => {
        const feature = featureArg as any
        if (!feature || !feature.properties) return
        
        const clusterName = feature.properties.Final_Prio || '-';
        
        layer.bindTooltip(
          `<div class="cluster-tooltip-content">${clusterName}</div>`,
          {
            sticky: true,
            opacity: 1.0,
            className: 'cluster-tooltip',
            direction: 'auto',
            permanent: false
          }
        );
      }}
    />
  );
});
```

### 8. Legend System

#### Dynamic Legend
```typescript
const siteCounts = useMemo(() => {
  const swappedCount = existingSites.filter(site => 
    site.cutover_af !== null && 
    site.site_dismantle_af === null
  ).length

  const dismantledCount = existingSites.filter(site => 
    site.cutover_af !== null && site.site_dismantle_af !== null
  ).length

  const exceptionCount = existingSites.filter(site => 
    site.site_status?.toLowerCase() === 'exception' && site.cutover_af === null
  ).length

  const notYetSwapCount = existingSites.filter(site => 
    site.cutover_af === null && 
    !(site.site_status?.toLowerCase() === 'exception')
  ).length

  return {
    swapped: swappedCount,
    dismantled: dismantledCount,
    exception: exceptionCount,
    notYetSwap: notYetSwapCount
  }
}, [existingSites])
```

### 9. Filter Integration

#### Legend Click Handler
```typescript
const handleLegendClick = useCallback((type: string, value: string) => {
  const currentFilters = allFilters.cardFilter.find(f => f.type === type)?.value || []
  let newValue: string[]

  if (currentFilters.includes(value)) {
    newValue = currentFilters.filter(v => v !== value)
  } else {
    newValue = [...currentFilters, value]
  }

  updateFilter('cardFilter', type, newValue)
}, [allFilters, updateFilter])
```

### 10. Full Screen Mode

#### Portal Implementation
```typescript
// Render portal jika full screen
if (isFullScreen && typeof window !== 'undefined') {
  return ReactDOM.createPortal(mapContent, document.body)
}

// Render normal
return mapContent
```

## CSS Styling

### Tooltip Styles
```css
.cluster-tooltip {
  background-color: white !important;
  border: 2px solid #333 !important;
  border-radius: 4px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  font-size: 14px !important;
  padding: 5px 8px !important;
  white-space: nowrap !important;
  z-index: 10000 !important;
  min-width: 50px !important;
  pointer-events: none !important;
  opacity: 1 !important;
}

.cluster-tooltip-content {
  font-size: 13px !important;
  min-width: 120px !important;
  text-align: center !important;
  font-weight: bold !important;
  font-family: sans-serif !important;
}
```

## Best Practices

### 1. Performance Optimization
- Gunakan `preferCanvas={true}` untuk performa yang lebih baik
- Implementasikan throttling dan debouncing
- Batasi jumlah marker berdasarkan zoom level
- Gunakan caching untuk warna dan data

### 2. Memory Management
- Cleanup event listeners saat component unmount
- Hapus layer yang tidak terpakai
- Gunakan `useMemo` dan `useCallback` untuk optimasi

### 3. User Experience
- Implementasikan loading states
- Gunakan tooltip yang informatif
- Sediakan legend yang interaktif
- Support full screen mode

### 4. Error Handling
- Validasi koordinat sebelum render
- Handle missing data gracefully
- Implementasikan fallback untuk icon yang hilang

## Troubleshooting

### 1. Marker Icons Tidak Muncul
```typescript
// Pastikan path icon benar
const icon = L.icon({
  iconUrl: '/images/leaflet/marker-icon.png',
  iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
})
```

### 2. Performance Issues
- Kurangi jumlah marker yang di-render
- Gunakan canvas renderer
- Implementasikan viewport-based rendering

### 3. SSR Issues
- Gunakan dynamic import dengan `ssr: false`
- Implementasikan loading state

## Kesimpulan

Implementasi map ini menggunakan React Leaflet dengan optimasi performa yang canggih, termasuk:
- Canvas-based rendering untuk performa tinggi
- Dynamic clustering dan filtering
- Interactive legend system
- Full screen mode
- Memory management yang baik
- Error handling yang robust

Dengan mengikuti panduan ini, Anda dapat membuat map interaktif yang performant dan user-friendly.

"use client"

import { Briefcase, Home as HomeIcon, Map, Users } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState, useMemo } from "react"

import { BottomNav } from "@/components/home/BottomNav"
import { DesktopNav } from "@/components/home/DesktopNav"
import { NavigationAction } from "@/types/home"
import type { CityData } from "@/components/maps/IndonesiaMap"

// Dynamic import untuk disable SSR (Server-Side Rendering)
// Leaflet memerlukan window object yang hanya tersedia di client
const IndonesiaMap = dynamic(() => import("@/components/maps/IndonesiaMap").then(mod => ({ default: mod.IndonesiaMap })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[600px] items-center justify-center rounded-2xl border border-white/10 bg-[#0F1630]/75">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
        <p className="text-white/60">Loading map...</p>
      </div>
    </div>
  )
})

const navActions: NavigationAction[] = [
  { id: "home", label: "Home", href: "/", icon: HomeIcon },
  { id: "projects", label: "Project", href: "/projects", icon: Briefcase },
  { id: "vendor", label: "Vendor", href: "/vendors", icon: Users },
  { id: "map", label: "Map", href: "/map", icon: Map },
]

export default function MapPage() {
  const [cities, setCities] = useState<CityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch cities data from API
  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/map/cities')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch cities: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        setCities(data.cities || [])
      } catch (err) {
        console.error('Error fetching cities:', err)
        setError(err instanceof Error ? err.message : 'Failed to load city data')
        setCities([])
      } finally {
        setLoading(false)
      }
    }

    fetchCities()
  }, [])

  return (
    <main className="relative h-screen overflow-hidden bg-[#05050F]">
      <DesktopNav
        actions={navActions}
        activeId="map"
        logoSrc="/logo-indosat-putih.png"
        logoAlt="Indosat Ooredoo Hutchison"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f1b3f,transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#ff2cfb]/30 via-[#5de3db]/30 to-transparent blur-[120px]"
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full w-full flex-col pt-16 lg:pt-20">
        {/* Header section - compact */}
        <div className="flex-shrink-0 px-4 pt-2 pb-2 lg:px-6 lg:pt-3 lg:pb-2">
          <h1 className="text-lg font-semibold text-white lg:text-xl">Map View</h1>
          <p className="text-xs text-white/60 lg:text-sm">
            Site locations and deployment tracking across Indonesia.
          </p>
        </div>
        
        {/* Map section - takes remaining space */}
        <div className="flex-1 overflow-hidden px-4 pb-20 lg:pb-6">
          <div className="h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {error ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-red-600 mb-2">Error loading map data</p>
                  <p className="text-xs text-gray-500">{error}</p>
                </div>
              </div>
            ) : (
              <IndonesiaMap height="100%" cities={cities} loading={loading} />
            )}
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <BottomNav actions={navActions} activeId="map" />
      </div>
    </main>
  )
}


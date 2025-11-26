import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { EXCLUDED_PROGRAM_REPORTS } from '@/lib/hermes-5g-constants'

// Mapping koordinat untuk kota-kota Indonesia yang umum
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Bandung': { lat: -6.9175, lng: 107.6191 },
  'Surabaya': { lat: -7.2575, lng: 112.7521 },
  'Medan': { lat: 3.5952, lng: 98.6722 },
  'Semarang': { lat: -6.9667, lng: 110.4167 },
  'Palembang': { lat: -2.9761, lng: 104.7754 },
  'Makassar': { lat: -5.1477, lng: 119.4327 },
  'Batam': { lat: 1.0456, lng: 104.0305 },
  'Denpasar': { lat: -8.6705, lng: 115.2126 },
  'Malang': { lat: -7.9797, lng: 112.6304 },
  'Yogyakarta': { lat: -7.7956, lng: 110.3695 },
  'Padang': { lat: -0.9492, lng: 100.3543 },
  'Pekanbaru': { lat: 0.5071, lng: 101.4478 },
  'Pontianak': { lat: -0.0263, lng: 109.3425 },
  'Balikpapan': { lat: -1.2675, lng: 116.8289 },
  'Manado': { lat: 1.4748, lng: 124.8426 },
  'Banjarmasin': { lat: -3.3194, lng: 114.5914 },
  'Jambi': { lat: -1.6101, lng: 103.6131 },
  'Cirebon': { lat: -6.7320, lng: 108.5523 },
  'Tangerang': { lat: -6.1783, lng: 106.6319 },
  'Bekasi': { lat: -6.2383, lng: 106.9756 },
  'Depok': { lat: -6.3947, lng: 106.8186 },
  'Bogor': { lat: -6.5944, lng: 106.7892 },
  'Surakarta': { lat: -7.5661, lng: 110.8258 },
  'Bandar Lampung': { lat: -5.4500, lng: 105.2667 },
  'Cimahi': { lat: -6.8841, lng: 107.5413 },
  'Tasikmalaya': { lat: -7.3274, lng: 108.2208 },
  'Kediri': { lat: -7.8167, lng: 112.0167 },
  'Serang': { lat: -6.1104, lng: 106.1504 },
  'Mataram': { lat: -8.5833, lng: 116.1167 },
}

// Helper function untuk mendapatkan koordinat kota
function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  // Normalize city name (remove extra spaces, convert to title case)
  const normalized = cityName.trim()
  
  // Check exact match
  if (CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized]
  }
  
  // Check case-insensitive match
  const found = Object.keys(CITY_COORDINATES).find(
    key => key.toLowerCase() === normalized.toLowerCase()
  )
  
  if (found) {
    return CITY_COORDINATES[found]
  }
  
  return null
}

// Helper function untuk menghitung status dari row
function calculateStatus(row: {
  rfs_af?: string | null
  imp_integ_af?: string | null
  ic_000040_af?: string | null
  mos_af?: string | null
}): 'ACTIVE' | 'READY' | 'RFI' | 'SOW' {
  if (row.rfs_af) return 'ACTIVE'
  if (row.imp_integ_af) return 'READY'
  if (row.ic_000040_af || row.mos_af) return 'RFI'
  return 'SOW'
}

export async function GET(request: NextRequest) {
  try {
    // Get distinct imp_ttp values with aggregated data
    let query = supabase
      .from('site_data_5g')
      .select('imp_ttp, lat, long, rfs_af, imp_integ_af, ic_000040_af, mos_af')
      .not('imp_ttp', 'is', null)
      .neq('imp_ttp', '')

    // Exclude excluded program reports
    EXCLUDED_PROGRAM_REPORTS.forEach((excludedProgram) => {
      query = query.neq('program_report', excludedProgram)
    })

    const { data, error } = await query

    if (error) {
      console.error('Supabase Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch city data', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ cities: [] })
    }

    // Group by imp_ttp and calculate aggregates
    const cityMap = new Map<string, {
      name: string
      lat: number | null
      lng: number | null
      sow: number
      readiness: number
      activated: number
    }>()

    data.forEach((row) => {
      const cityName = row.imp_ttp?.trim()
      if (!cityName) return

      const status = calculateStatus(row)
      
      if (!cityMap.has(cityName)) {
        // Try to get coordinates from row or from mapping
        let lat: number | null = row.lat ?? null
        let lng: number | null = row.long ?? null

        // If no coordinates in row, try to get from mapping
        if (!lat || !lng) {
          const coords = getCityCoordinates(cityName)
          if (coords) {
            lat = coords.lat
            lng = coords.lng
          }
        }

        cityMap.set(cityName, {
          name: cityName,
          lat,
          lng,
          sow: 0,
          readiness: 0,
          activated: 0,
        })
      }

      const city = cityMap.get(cityName)!
      city.sow += 1 // Total sites = SOW
      
      if (status === 'READY' || status === 'ACTIVE') {
        city.readiness += 1
      }
      
      if (status === 'ACTIVE') {
        city.activated += 1
      }
    })

    // Convert map to array and filter out cities without coordinates
    const cities = Array.from(cityMap.values())
      .filter(city => city.lat !== null && city.lng !== null)
      .map(city => ({
        id: city.name.toLowerCase().replace(/\s+/g, '-'),
        name: city.name,
        lat: city.lat!,
        lng: city.lng!,
        sow: city.sow,
        readiness: city.readiness,
        activated: city.activated,
        plan: 'TBD', // Placeholder, bisa diambil dari data lain jika ada
      }))
      .sort((a, b) => b.sow - a.sow) // Sort by SOW count descending

    return NextResponse.json({
      cities,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching city data:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


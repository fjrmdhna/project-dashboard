"use client"

import { useMemo, ReactNode } from "react"
import { BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  ReferenceLine
} from "recharts"

// Tipe data untuk row dari site_data_5g
type Row = {
  imp_ttp?: string | null
  imp_integ_af?: string | null
}

// Tipe data untuk props komponen
type Props = {
  rows: Row[]
  maxCities?: number
}

// Tipe data untuk item chart
type ChartItem = {
  city: string
  ny: number // Nilai negatif untuk NY Readiness
  rdy: number | null // Nilai positif untuk Readiness, bisa null untuk nilai 0
  total: number // Total absolut
}

// Fungsi helper untuk normalisasi nama kota
function normalizeCity(city: string | null | undefined): string {
  if (!city) return "Unknown"
  // Trim whitespace dan konversi ke uppercase untuk konsistensi
  return city.trim().toUpperCase()
}

// Komponen untuk custom tick pada YAxis
function CityTick(props: any) {
  const { x, y, payload } = props
  
  // Tambahkan pengecekan untuk menghindari error
  if (!payload || !payload.value) {
    return null
  }
  
  // Cari data yang sesuai dengan payload value
  const chartData = props.chartData || []
  const item = chartData.find((d: ChartItem) => d.city === payload.value)
  
  if (!item) {
    return (
      <text 
        x={x} 
        y={y} 
        dy="0.32em" 
        textAnchor="start" 
        fill="#E7ECF3" 
        fontSize={12}
      >
        {payload.value}
      </text>
    )
  }
  
  return (
    <text 
      x={x} 
      y={y} 
      dy="0.32em" 
      textAnchor="start" 
      fill="#E7ECF3" 
      fontSize={12}
    >
      {item.city} ({item.total})
    </text>
  )
}

// Custom label untuk NY Readiness
const NyLabel = (props: any) => {
  const { x, y, width, height, value } = props
  
  // Jika nilai terlalu kecil, jangan tampilkan
  if (value < 5) return null
  
  // Jika bar terlalu panjang, posisikan label di dalam bar
  const isLongBar = width > 150
  
  return (
    <text
      x={isLongBar ? x + width - 8 : x + width + 4}
      y={y + height / 2}
      fill="#fff"
      fontSize={10}
      textAnchor={isLongBar ? "end" : "start"}
      dominantBaseline="central"
      style={{ 
        filter: isLongBar ? 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))' : 'none',
        textShadow: isLongBar ? '0px 0px 3px rgba(0,0,0,0.8)' : 'none'
      }}
    >
      {value.toLocaleString()}
    </text>
  )
}

// Custom label untuk Readiness (sisi kanan)
const ReadyLabel = (props: any) => {
  const { x, y, width, height, value } = props
  
  // Jika nilai terlalu kecil, jangan tampilkan
  if (value < 5) return null
  
  // Jika bar terlalu panjang, posisikan label di dalam bar
  const isLongBar = width > 150
  
  return (
    <text
      x={isLongBar ? x + width - 8 : x + width + 4}
      y={y + height / 2}
      fill="#fff"
      fontSize={10}
      textAnchor={isLongBar ? "end" : "start"}
      dominantBaseline="central"
      style={{ 
        filter: isLongBar ? 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))' : 'none',
        textShadow: isLongBar ? '0px 0px 3px rgba(0,0,0,0.8)' : 'none'
      }}
    >
      {value.toLocaleString()}
    </text>
  )
}

export function FiveGReadinessCard({ rows, maxCities = 10 }: Props) {
  // Agregasi data untuk chart
  const chartData = useMemo(() => {
    // Buat map untuk menghitung jumlah NY dan Ready per kota
    const cityMap = new Map<string, { ny: number; rdy: number }>()
    
    // Iterasi setiap row untuk agregasi
    rows.forEach(row => {
      const city = normalizeCity(row.imp_ttp)
      const isReady = !!row.imp_integ_af
      
      // Ambil atau inisialisasi data kota
      const cityData = cityMap.get(city) || { ny: 0, rdy: 0 }
      
      // Update counter sesuai status
      if (isReady) {
        cityData.rdy++
      } else {
        cityData.ny++
      }
      
      // Simpan kembali ke map
      cityMap.set(city, cityData)
    })
    
    // Konversi map ke array untuk sorting
    const result: ChartItem[] = Array.from(cityMap.entries()).map(([city, data]) => ({
      city,
      ny: Math.abs(data.ny || 0), // Nilai POSITIF untuk NY Readiness
      rdy: data.rdy > 0 ? Math.abs(data.rdy) : null, // Nilai POSITIF untuk Readiness
      total: data.ny + data.rdy // Total absolut
    }))
    
    // Sort by total (descending)
    const sortedResult = result.sort((a, b) => 
      (b.rdy || 0) + (b.ny || 0) - ((a.rdy || 0) + (a.ny || 0))
    )
    
    // Cek apakah Surabaya ada dalam data
    const surabayaIndex = sortedResult.findIndex(item => 
      item.city === "SURABAYA"
    )
    
    // Jika Surabaya ada tapi tidak dalam top maxCities
    if (surabayaIndex >= maxCities && surabayaIndex !== -1) {
      // Ambil top (maxCities-1) dan tambahkan Surabaya
      const topCities = sortedResult.slice(0, maxCities - 1)
      topCities.push(sortedResult[surabayaIndex])
      return topCities
    }
    
    // Jika tidak, ambil top maxCities seperti biasa
    return sortedResult.slice(0, maxCities)
  }, [rows, maxCities])

  // Hitung nilai maksimum untuk domain
  const maxValue = useMemo(() => {
    let max = 0
    chartData.forEach(item => {
      max = Math.max(max, item.ny || 0, item.rdy || 0)
    })
    return Math.ceil(max * 1.1)
  }, [chartData])

  // Render custom tick dengan data chart
  const renderCityTick = (props: any) => {
    return <CityTick {...props} chartData={chartData} />
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col" style={{ padding: 'var(--wb-card-padding)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-purple-500/20 p-1.5 rounded-lg">
          <BarChart3 className="h-4 w-4 text-purple-400" />
        </div>
        <div className="text-xs font-medium bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
          5G Readiness by City
        </div>
      </div>
      
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 10, bottom: 20, left: 40 }}
            barCategoryGap={6}
          >
            <XAxis 
              type="number" 
              domain={[0, maxValue]} 
              tickFormatter={(v) => v.toLocaleString()}
            />
            <YAxis
              type="category"
              dataKey="city"
              orientation="right"
              axisLine={false}
              tickLine={false}
              interval={0}
              width={140}
              tick={renderCityTick}
            />
            <Tooltip
              formatter={(value, name) => {
                return [value.toLocaleString(), name]
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              align="center" 
              wrapperStyle={{ paddingTop: "10px" }}
            />
            <Bar 
              dataKey="ny" 
              name="NY Readiness" 
              fill="#8A5AA3" 
              barSize={16}
              minPointSize={2}
            >
              <LabelList
                content={<NyLabel />}
              />
            </Bar>
            <Bar 
              dataKey="rdy" 
              name="Readiness" 
              fill="#7CB342" 
              barSize={16}
            >
              <LabelList
                content={<ReadyLabel />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 
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
  rfs_af?: string | null
}

// Tipe data untuk props komponen
type Props = {
  rows: Row[]
  maxCities?: number
}

// Tipe data untuk item chart
type ChartItem = {
  city: string
  ny: number // Nilai negatif untuk NY Active
  act: number | null // Nilai positif untuk Activated, bisa null untuk nilai 0
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
        fontSize={10}
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
      fontSize={10}
    >
      {item.city} ({item.total})
    </text>
  )
}

// Custom label untuk NY Active (logic rapih ala Readiness)
const NyLabel = (props: any) => {
  const { x, y, width, height, value } = props
  if (value <= 0 || !width) return null
  const insideThreshold = 36
  const isInside = width >= insideThreshold
  const posX = isInside ? (x + width - 6) : (x + width + 6)
  const posY = y + height / 2
  return (
    <text
      x={posX}
      y={posY}
      fill="#fff"
      fontSize={7}
      textAnchor={isInside ? 'end' : 'start'}
      dominantBaseline={'central'}
      style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))', textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }}
    >
      {value.toLocaleString()}
    </text>
  )
}

// Custom label untuk Activated (logic rapih ala Readiness)
const ActivatedLabel = (props: any) => {
  const { x, y, width, height, value } = props
  if (value <= 0 || !width) return null
  const insideThreshold = 36
  const isInside = width >= insideThreshold
  const posX = isInside ? (x + width - 6) : (x + width + 6)
  const posY = y + height / 2
  return (
    <text
      x={posX}
      y={posY}
      fill="#fff"
      fontSize={7}
      textAnchor={isInside ? 'end' : 'start'}
      dominantBaseline={'central'}
      style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))', textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }}
    >
      {value.toLocaleString()}
    </text>
  )
}

export function FiveGActivatedCard({ rows, maxCities = 10 }: Props) {
  // Agregasi data untuk chart
  const chartData = useMemo(() => {
    // Buat map untuk menghitung jumlah NY dan Activated per kota
    const cityMap = new Map<string, { ny: number; act: number }>()
    
    // Iterasi setiap row untuk agregasi
    rows.forEach(row => {
      const city = normalizeCity(row.imp_ttp)
      const isActivated = !!row.rfs_af
      
      // Ambil atau inisialisasi data kota
      const cityData = cityMap.get(city) || { ny: 0, act: 0 }
      
      // Update counter sesuai status
      if (isActivated) {
        cityData.act++
      } else {
        cityData.ny++
      }
      
      // Simpan kembali ke map
      cityMap.set(city, cityData)
    })
    
    // Konversi map ke array untuk sorting
    const result: ChartItem[] = Array.from(cityMap.entries()).map(([city, data]) => ({
      city,
      ny: Math.abs(data.ny || 0), // Nilai POSITIF untuk NY Activated
      act: data.act > 0 ? Math.abs(data.act) : null, // Nilai POSITIF untuk Activated
      total: data.ny + data.act // Total absolut
    }))
    
    // Sort by total (descending)
    const sortedResult = result.sort((a, b) => 
      (b.act || 0) + (b.ny || 0) - ((a.act || 0) + (a.ny || 0))
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
      max = Math.max(max, item.ny || 0, item.act || 0)
    })
    return Math.ceil(max * 1.1)
  }, [chartData])

  // Render custom tick dengan data chart
  const renderCityTick = (props: any) => {
    return <CityTick {...props} chartData={chartData} />
  }

  return (
    <div className="activated-card rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0" style={{ padding: 'calc(var(--wb-card-padding) - 4px)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="bg-green-500/20 p-1 rounded-lg">
          <BarChart3 className="h-3.5 w-3.5 text-green-400" />
        </div>
        <div className="responsive-text-sm font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
          5G Activation by City
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 8, left: 28 }}
            barCategoryGap={4}
          >
            <XAxis 
              type="number" 
              domain={[0, maxValue]} 
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: 8, fill: '#B0B7C3' }}
            />
            <YAxis
              type="category"
              dataKey="city"
              orientation="right"
              axisLine={false}
              tickLine={false}
              interval={0}
              width={120}
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
              wrapperStyle={{ paddingTop: 6 }}
            />
            <Bar 
              dataKey="ny" 
              name="NY Active" 
              fill="#FF7043" 
              barSize={12}
              minPointSize={2}
            >
              <LabelList
                content={<NyLabel />}
              />
            </Bar>
            <Bar 
              dataKey="act" 
              name="Activated" 
              fill="#26A69A" 
              barSize={12}
            >
              <LabelList
                content={<ActivatedLabel />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 

"use client"

import { useMemo, ReactNode } from "react"
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

// Custom label untuk NY Active (sisi kiri)
const NyLabel = (props: any) => {
  const { x, y, width, height, value } = props
  const absValue = Math.abs(value)
  
  // Jika nilai terlalu kecil, jangan tampilkan
  if (absValue < 5) return null
  
  return (
    <text
      x={x - 8} // Posisi di luar bar (kiri)
      y={y + height / 2}
      fill="#fff"
      fontSize={11}
      textAnchor="end"
      dominantBaseline="central"
    >
      {absValue.toLocaleString()}
    </text>
  )
}

// Custom label untuk Activated (sisi kanan)
const ActivatedLabel = (props: any) => {
  const { x, y, width, height, value } = props
  
  // Jika nilai terlalu kecil, jangan tampilkan
  if (value < 5) return null
  
  return (
    <text
      x={x + width + 8} // Posisi di luar bar (kanan)
      y={y + height / 2}
      fill="#fff"
      fontSize={11}
      textAnchor="start"
      dominantBaseline="central"
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
      ny: -Math.abs(data.ny || 0), // Selalu nilai NEGATIF
      act: data.act > 0 ? Math.abs(data.act) : null, // Konversi 0 menjadi null
      total: data.ny + data.act // Total absolut
    }))
    
    // Sort by total (descending)
    const sortedResult = result.sort((a, b) => 
      (b.act || 0) + Math.abs(b.ny) - ((a.act || 0) + Math.abs(a.ny))
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

  // Hitung nilai maksimum absolut untuk domain
  const maxAbs = useMemo(() => {
    let max = 0
    chartData.forEach(item => {
      max = Math.max(max, Math.abs(item.ny), item.act || 0)
    })
    return Math.ceil(max * 1.1)
  }, [chartData])

  // Render custom tick dengan data chart
  const renderCityTick = (props: any) => {
    return <CityTick {...props} chartData={chartData} />
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col" style={{ padding: 'var(--wb-card-padding)' }}>
      <div className="text-base font-semibold mb-1">5G Activation by City</div>
      
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 40, bottom: 20, left: 40 }}
            barCategoryGap={6}
          >
            <XAxis 
              type="number" 
              domain={[-maxAbs, maxAbs]} 
              tickFormatter={(v) => Math.abs(v).toLocaleString()}
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
                const val = Math.abs(value as number)
                return [val.toLocaleString(), name]
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              align="center" 
              wrapperStyle={{ paddingTop: "8px" }}
            />
            <ReferenceLine x={0} stroke="#8ba3c7" strokeOpacity={0.5} />
            <Bar 
              dataKey="ny" 
              name="NY Active" 
              fill="#FF7043" 
              barSize={16}
              minPointSize={2}
              stackId="a"
            >
              <LabelList
                content={<NyLabel />}
              />
            </Bar>
            <Bar 
              dataKey="act" 
              name="Activated" 
              fill="#26A69A" 
              barSize={16}
              stackId="a"
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
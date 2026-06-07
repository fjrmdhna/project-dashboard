"use client"

import { useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"
import {
  isMilestoneAchieved,
  resolveMilestoneColumns,
  type HermesMilestoneFields,
} from "@/lib/hermes-milestone-fields"
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

// Tipe data untuk row dari site_data_5g atau site_data_aop
type Row = {
  imp_ttp?: string | null
  nano_cluster?: string | null
  region_circle?: string | null
  imp_integ_af?: string | null
  readiness_2600_af?: string | null
  ic_000010_af?: string | null // RFI header for AOP
}

// Pre-aggregated data from useAopData hook (OPTIMIZATION)
// rfi is optional because Hermes 5G doesn't use it
type AggregatedByCircle = Map<string, { total: number; ready: number; activated: number; rfi?: number }>

// Tipe data untuk props komponen
type Props = {
  rows: Row[]
  maxCities?: number
  variant?: 'city' | 'circle' // Variant untuk menentukan apakah menggunakan city atau circle
  dataVariant?: 'default' | 'aop' // Data variant untuk menentukan field yang digunakan
  // OPTIMIZATION: Pre-aggregated data to avoid 41k row iteration
  aggregatedByCircle?: AggregatedByCircle
  milestoneFields?: HermesMilestoneFields
}

// Tipe data untuk item chart
type ChartItem = {
  city: string
  circle: string
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

// Fungsi helper untuk normalisasi nama circle dengan Title Case
function normalizeCircle(circle: string | null | undefined): string {
  if (!circle) return "Unknown"
  const trimmed = circle.trim()
  // Konversi ke Title Case (sama seperti formatCircleValue di supabase.ts)
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())
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
  const variant = props.variant || 'city'
  const item = chartData.find((d: ChartItem) => 
    variant === 'circle' ? d.circle === payload.value : d.city === payload.value
  )
  
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
  
  const displayName = variant === 'circle' ? item.circle : item.city
  
  return (
    <text 
      x={x} 
      y={y} 
      dy="0.32em" 
      textAnchor="start" 
      fill="#E7ECF3" 
      fontSize={10}
    >
      {displayName} ({item.total})
    </text>
  )
}

// Custom label untuk NY Readiness (selalu di dalam bar jika memungkinkan)
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

// Custom label untuk Readiness (selalu di dalam bar jika memungkinkan)
const ReadyLabel = (props: any) => {
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

export function FiveGReadinessCard({ rows, maxCities = 10, variant = 'city', dataVariant = 'default', aggregatedByCircle, milestoneFields }: Props) {
  const { readinessColumn } = resolveMilestoneColumns(milestoneFields)
  const [pageIndex, setPageIndex] = useState(0)

  // Agregasi data untuk chart - OPTIMIZED: Use pre-aggregated data if available
  const allChartData = useMemo(() => {
    // OPTIMIZATION: If pre-aggregated data is available, use it (O(1) instead of O(n))
    if (aggregatedByCircle && (variant === 'circle' || variant === 'city')) {
      const result: ChartItem[] = Array.from(aggregatedByCircle.entries()).map(([location, data]) => {
        // For AOP, use rfi field; for default, use ready field
        const rdyCount = dataVariant === 'aop' ? (data as any).rfi : data.ready
        const nyCount = data.total - rdyCount
        return {
          city: variant === 'circle' ? '' : location,
          circle: variant === 'circle' ? normalizeCircle(location) : '',
          ny: Math.abs(nyCount),
          rdy: rdyCount > 0 ? Math.abs(rdyCount) : null,
          total: data.total
        }
      })
      
      return result.sort((a, b) => 
        (b.rdy || 0) + (b.ny || 0) - ((a.rdy || 0) + (a.ny || 0))
      )
    }
    
    // Fallback: Aggregate from rows (legacy path)
    const locationMap = new Map<string, { ny: number; rdy: number }>()
    
    rows.forEach(row => {
      const location = variant === 'circle' 
        ? normalizeCircle(row.nano_cluster || row.region_circle)
        : normalizeCity(row.imp_ttp)
      
      const isReady = dataVariant === 'aop'
        ? !!row.ic_000010_af
        : isMilestoneAchieved(row, readinessColumn)
      
      const locationData = locationMap.get(location) || { ny: 0, rdy: 0 }
      
      if (isReady) {
        locationData.rdy++
      } else {
        locationData.ny++
      }
      
      locationMap.set(location, locationData)
    })
    
    const result: ChartItem[] = Array.from(locationMap.entries()).map(([location, data]) => ({
      city: variant === 'circle' ? '' : location,
      circle: variant === 'circle' ? location : '',
      ny: Math.abs(data.ny || 0),
      rdy: data.rdy > 0 ? Math.abs(data.rdy) : null,
      total: data.ny + data.rdy
    }))
    
    return result.sort((a, b) => 
      (b.rdy || 0) + (b.ny || 0) - ((a.rdy || 0) + (a.ny || 0))
    )
  }, [rows, variant, dataVariant, aggregatedByCircle, readinessColumn])

  const totalPages = useMemo(() => {
    if (!maxCities || maxCities <= 0) return 1
    return Math.max(1, Math.ceil(allChartData.length / maxCities))
  }, [allChartData.length, maxCities])

  const chartData = useMemo(() => {
    if (!maxCities || maxCities <= 0) return allChartData
    const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))
    const start = safePageIndex * maxCities
    const end = start + maxCities
    return allChartData.slice(start, end)
  }, [allChartData, maxCities, pageIndex, totalPages])

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
    return <CityTick {...props} chartData={chartData} variant={variant} />
  }

  // Determine display label based on variant and dataVariant
  const displayLabel = useMemo(() => {
    if (dataVariant === 'aop' && variant === 'circle') {
      return 'RFI by Circle'
    }
    if (variant === 'circle') {
      return 'Readiness by Circle'
    }
    return milestoneFields?.readinessCardTitle ?? '5G Readiness by City'
  }, [variant, dataVariant, milestoneFields])
  
  const dataKey = variant === 'circle' ? 'circle' : 'city'
  
  // Determine legend labels based on dataVariant
  const nyLegendLabel = dataVariant === 'aop' ? 'NY RFI' : 'NY Readiness'
  const rdyLegendLabel = dataVariant === 'aop' ? 'RFI' : 'Readiness'

  return (
    <div className="readiness-card rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0" style={{ padding: 'calc(var(--wb-card-padding) - 4px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-purple-500/20 p-1 rounded-lg">
            <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
            {displayLabel}
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-[10px] text-white/60">
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={pageIndex === 0}
              className="h-5 w-5 flex items-center justify-center rounded-full border border-white/20 bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/15 transition"
              aria-label="Previous cities"
            >
              ‹
            </button>
            <span>{pageIndex + 1}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={pageIndex >= totalPages - 1}
              className="h-5 w-5 flex items-center justify-center rounded-full border border-white/20 bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/15 transition"
              aria-label="Next cities"
            >
              ›
            </button>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 0, bottom: 5, left: 28 }}
            barCategoryGap={4}
          >
            <XAxis 
              type="number" 
              domain={[0, maxValue]} 
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: 11, fill: '#B0B7C3' }}
            />
            <YAxis
              type="category"
              dataKey={dataKey}
              orientation="right"
              axisLine={false}
              tickLine={false}
              interval={0}
              width={120}
              tick={renderCityTick}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '10px',
                padding: '6px 8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{
                color: '#000000',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '2px'
              }}
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
              name={nyLegendLabel} 
              fill="#8A5AA3" 
              barSize={12}
              minPointSize={2}
            >
              <LabelList
                content={<NyLabel />}
              />
            </Bar>
            <Bar 
              dataKey="rdy" 
              name={rdyLegendLabel} 
              fill="#7CB342" 
              barSize={12}
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

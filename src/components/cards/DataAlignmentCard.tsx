"use client"

import { useMemo } from "react"
import { Search } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from "recharts"

// Definisi props untuk komponen
export interface DataAlignmentCardProps {
  records: any[]
  filter?: (row: any) => boolean
  barColor?: string
}

// Definisi struktur data untuk chart
interface ChartItem {
  key: string
  value: number
}

export function DataAlignmentCard({
  records,
  filter,
  barColor = "#7CB342"
}: DataAlignmentCardProps) {
  // Memproses data untuk chart dengan agregasi
  const chartData = useMemo(() => {
    // Filter records jika filter function disediakan
    const filteredRecords = filter ? records.filter(filter) : records

    // Mapping header ke label sumbu X
    const headerMapping = [
      { field: 'caf_approved', label: 'CAF' },
      { field: 'mos_af', label: 'MOS' },
      { field: 'ic_000040_af', label: 'INSTALL' },
      { field: 'imp_integ_af', label: 'READINESS' },
      { field: 'rfs_af', label: 'ACTIVATED' },
      { field: 'rfc_approved', label: 'RFC' },
      { field: 'hotnews_af', label: 'HN' },
      { field: 'endorse_af', label: 'ENDORSE' }
    ]

    // Agregasi data
    return headerMapping.map(({ field, label }) => {
      const count = filteredRecords.filter(record => {
        const value = record[field]
        return value !== null && value !== undefined && value !== ""
      }).length

      return {
        key: label,
        value: count
      }
    })
  }, [records, filter])

  // Custom label untuk menampilkan angka di atas bar
  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, value } = props
    
    // Jangan tampilkan label jika value = 0
    if (value === 0) return null
    
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#FFFFFF"
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        style={{ 
          filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))',
          textShadow: '0px 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        {value}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A2340] border border-white/10 px-3 py-2 rounded-md responsive-text-sm">
          <p className="text-white/90">{`${payload[0].payload.key}: ${payload[0].value}`}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0" style={{ padding: 'var(--wb-card-padding)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-0 flex-shrink-0">
        <div className="bg-blue-500/20 p-1.5 rounded-lg">
          <Search className="h-4 w-4 text-blue-400" />
        </div>
        <div className="responsive-text-sm font-medium bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
          Data Alignment
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 flex min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 25,
              right: 20,
              bottom: 5,
              left: -15
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis 
              dataKey="key"
              tick={{ fill: '#B0B7C3', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              angle={-45}
              height={undefined}
              textAnchor="end"
              interval={0}
              tickMargin={5}
            />
            <YAxis 
              tick={{ fill: '#B0B7C3', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar 
              dataKey="value"
              fill={barColor}
              radius={[4, 4, 0, 0]}
              barSize={30}
              animationDuration={800}
            >
              <LabelList 
                dataKey="value" 
                content={renderCustomBarLabel}
                position="top"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 
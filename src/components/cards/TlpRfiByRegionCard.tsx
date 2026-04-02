"use client"

import { BarChart3 } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TlpRfiByRegionItem } from "@/hooks/useTlpRfiByRegion"

interface TlpRfiByRegionCardProps {
  rows: TlpRfiByRegionItem[]
  totalRfi: number
  isLoading?: boolean
  error?: string | null
}

export function TlpRfiByRegionCard({ rows, totalRfi, isLoading = false, error }: TlpRfiByRegionCardProps) {
  const chartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.rfi - a.rfi)
      .slice(0, 10)
      .map((item) => ({
        region: item.region,
        rfi: item.rfi,
      }))
  }, [rows])

  return (
    <div
      className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-500/20 p-1">
            <BarChart3 className="h-3.5 w-3.5 text-purple-300" />
          </div>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            RFI by Region
          </span>
        </div>
        <span className="text-[10px] font-semibold text-white/80">Total RFI: {totalRfi.toLocaleString()}</span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-red-300/90">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No data available</div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 18, right: 8, left: 6, bottom: 22 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="region"
                interval={0}
                minTickGap={0}
                angle={-35}
                textAnchor="end"
                tick={{ fill: "#D1D5DB", fontSize: 10, fontWeight: 600 }}
                axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
                tickLine={false}
                tickMargin={8}
                height={46}
              />
              <YAxis
                tick={{ fill: "#A7B0C2", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={38}
                tickFormatter={(value: number) => value.toLocaleString()}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "#0b122b",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "10px",
                  color: "#ffffff",
                  fontSize: "11px",
                }}
                formatter={(value: number) => [value.toLocaleString(), "RFI"]}
              />
              <Bar
                dataKey="rfi"
                radius={[6, 6, 0, 0]}
                fill="#4CAF50"
                maxBarSize={30}
                label={{ position: "top", fill: "#E5E7EB", fontSize: 10, fontWeight: 700 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

"use client"

import { Building2 } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TlpTopVendorRfiItem } from "@/hooks/useTlpTopVendorRfi"

interface TlpTopVendorRfiCardProps {
  rows: TlpTopVendorRfiItem[]
  isLoading?: boolean
  error?: string | null
}

export function TlpTopVendorRfiCard({ rows, isLoading = false, error }: TlpTopVendorRfiCardProps) {
  const chartData = useMemo(() => {
    return [...rows].sort((a, b) => b.rfi - a.rfi).slice(0, 5)
  }, [rows])

  return (
    <div
      className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <div className="rounded-lg bg-emerald-500/20 p-1">
          <Building2 className="h-3.5 w-3.5 text-emerald-300" />
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          Top 5 Vendor by RFI
        </span>
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
              layout="vertical"
              margin={{ top: 8, right: 14, left: 4, bottom: 8 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#A7B0C2", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
                tickFormatter={(value: number) => value.toLocaleString()}
              />
              <YAxis
                type="category"
                dataKey="vendor"
                tick={{ fill: "#D1D5DB", fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={72}
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
                fill="#4CAF50"
                radius={[0, 6, 6, 0]}
                maxBarSize={30}
              >
                <LabelList
                  dataKey="rfi"
                  position="right"
                  fill="#E5E7EB"
                  fontSize={10}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

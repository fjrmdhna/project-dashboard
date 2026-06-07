"use client"

import { BarChart3 } from "lucide-react"
import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TlpRfiByCircleItem } from "@/hooks/useTlpRfiByCircle"

import { TLP_ACTUAL_COLOR, TLP_PLAN_COLOR } from "@/lib/tlp-chart-colors"

const PLAN_COLOR = TLP_PLAN_COLOR
const ACTUAL_COLOR = TLP_ACTUAL_COLOR

interface TlpRfiByCircleCardProps {
  rows: TlpRfiByCircleItem[]
  totalPlanRfi: number
  totalActualRfi: number
  isLoading?: boolean
  error?: string | null
}

export function TlpRfiByCircleCard({
  rows,
  totalPlanRfi,
  totalActualRfi,
  isLoading = false,
  error,
}: TlpRfiByCircleCardProps) {
  const chartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.actual - a.actual)
      .map((item) => ({
        circle: item.circle,
        plan: item.plan,
        actual: item.actual,
      }))
  }, [rows])

  return (
    <div
      className="rounded-2xl bg-[#0F1630]/80 border border-white/5 w-full h-full flex flex-col min-w-0"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-500/20 p-1">
            <BarChart3 className="h-3.5 w-3.5 text-purple-300" />
          </div>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            RFI Plan vs Actual
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-white/80">
          <span>
            Plan: <span style={{ color: PLAN_COLOR }}>{totalPlanRfi.toLocaleString()}</span>
          </span>
          <span className="text-white/40">|</span>
          <span>
            Actual: <span style={{ color: ACTUAL_COLOR }}>{totalActualRfi.toLocaleString()}</span>
          </span>
        </div>
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
              margin={{ top: 18, right: 8, left: 6, bottom: 32 }}
              barCategoryGap="22%"
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="circle"
                interval={0}
                minTickGap={0}
                angle={-25}
                textAnchor="end"
                tick={{ fill: "#D1D5DB", fontSize: 9, fontWeight: 600 }}
                axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
                tickLine={false}
                tickMargin={8}
                height={52}
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
                formatter={(value: number, name: string) => [value.toLocaleString(), name]}
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ paddingTop: 4 }}
                formatter={(value) => <span className="text-[9px] text-white/80">{value}</span>}
              />
              <Bar
                dataKey="plan"
                name="Plan"
                fill={PLAN_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                label={{ position: "top", fill: PLAN_COLOR, fontSize: 9, fontWeight: 700 }}
              />
              <Bar
                dataKey="actual"
                name="Actual"
                fill={ACTUAL_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                label={{ position: "top", fill: "#E5E7EB", fontSize: 9, fontWeight: 700 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

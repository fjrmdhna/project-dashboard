"use client"

import { Building2 } from "lucide-react"
import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { LabelProps } from "recharts"
import type { TlpTopVendorRfiItem } from "@/hooks/useTlpTopVendorRfi"
import { TLP_ACTUAL_COLOR, TLP_PLAN_COLOR } from "@/lib/tlp-chart-colors"
import { sortVendorsChartRows } from "@/lib/tlp-vendor-aggregation"
import { TlpCardHeader, TlpCardHeaderPlanActual } from "@/components/cards/tlp/TlpCardHeader"

const PLAN_COLOR = TLP_PLAN_COLOR
const ACTUAL_COLOR = TLP_ACTUAL_COLOR

const CHART_MARGIN = { top: 24, right: 6, left: 0, bottom: 4 }

interface TlpTopVendorRfiCardProps {
  rows: TlpTopVendorRfiItem[]
  isLoading?: boolean
  error?: string | null
}

function truncateVendorLabel(label: string, maxLen = 9): string {
  const trimmed = label.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}

function VendorXAxisTick({
  x,
  y,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: string }
}) {
  if (x == null || y == null || !payload) return null

  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fill="#D1D5DB"
      fontSize={8}
      fontWeight={600}
    >
      {truncateVendorLabel(String(payload.value))}
    </text>
  )
}

function BarValueLabel({
  fill,
  x,
  y,
  width,
  value,
}: LabelProps & { fill: string }) {
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null
  if (value == null || Number(value) === 0) return null

  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill={fill}
      textAnchor="middle"
      fontSize={8}
      fontWeight={700}
      style={{ pointerEvents: "none" }}
    >
      {Number(value).toLocaleString()}
    </text>
  )
}

function PlanBarLabel(props: LabelProps) {
  return <BarValueLabel {...props} fill={PLAN_COLOR} />
}

function ActualBarLabel(props: LabelProps) {
  return <BarValueLabel {...props} fill="#E5E7EB" />
}

export function TlpTopVendorRfiCard({ rows, isLoading = false, error }: TlpTopVendorRfiCardProps) {
  const chartData = useMemo(() => sortVendorsChartRows(rows), [rows])

  const totalPlanRfi = useMemo(
    () => chartData.reduce((sum, row) => sum + row.plan, 0),
    [chartData]
  )
  const totalActualRfi = useMemo(
    () => chartData.reduce((sum, row) => sum + row.actual, 0),
    [chartData]
  )

  const yMax = useMemo(() => {
    let max = 0
    for (const row of chartData) {
      max = Math.max(max, row.plan, row.actual)
    }
    return Math.ceil(max * 1.15) || 10
  }, [chartData])

  const showLoading = isLoading && rows.length === 0

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-2xl border border-white/5 bg-[#0F1630]/80"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <TlpCardHeader
        title="Top 5 Vendor · Plan vs Actual"
        icon={Building2}
        tone="purple"
        trailing={
          <TlpCardHeaderPlanActual
            plan={totalPlanRfi}
            actual={totalActualRfi}
            planColor={PLAN_COLOR}
            actualColor={ACTUAL_COLOR}
          />
        }
      />

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-red-300/90">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No data available</div>
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={CHART_MARGIN}
              barCategoryGap="20%"
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="vendor"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
                tick={<VendorXAxisTick />}
                height={30}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fill: "#A7B0C2", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickCount={4}
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
                labelFormatter={(label) => String(label)}
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                wrapperStyle={{ paddingTop: 2 }}
                payload={[
                  { value: "Plan", type: "square", color: PLAN_COLOR, id: "plan" },
                  { value: "Actual", type: "square", color: ACTUAL_COLOR, id: "actual" },
                ]}
                formatter={(value) => <span className="text-[9px] text-white/80">{value}</span>}
              />
              <Bar
                dataKey="plan"
                name="Plan"
                fill={PLAN_COLOR}
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              >
                <LabelList dataKey="plan" content={<PlanBarLabel />} />
              </Bar>
              <Bar
                dataKey="actual"
                name="Actual"
                fill={ACTUAL_COLOR}
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              >
                <LabelList dataKey="actual" content={<ActualBarLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

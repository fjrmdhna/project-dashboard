"use client"

import { useMemo } from "react"
import { TrendingUp } from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { trimAccProgressPointsWithNoActivity, type AccProgressPoint } from "@/lib/tlp-acc-progress"
import { TlpCardHeader } from "@/components/cards/tlp/TlpCardHeader"

const SERIES = [
  { key: "planCcoAcc" as const, name: "Plan CCO ACC", color: "#3B82F6" },
  { key: "planRfiAcc" as const, name: "Plan RFI ACC", color: "#EAB308" },
  { key: "actualRfiAcc" as const, name: "Actual RFI ACC", color: "#4CAF50" },
  { key: "actualCrfiAcc" as const, name: "Actual CRFI ACC", color: "#EF4444" },
]

interface TlpAccProgressCurveCardProps {
  data: AccProgressPoint[]
  isLoading?: boolean
  error?: string | null
}

export function TlpAccProgressCurveCard({ data, isLoading = false, error }: TlpAccProgressCurveCardProps) {
  const chartData = useMemo(() => trimAccProgressPointsWithNoActivity(data), [data])
  const showLoading = isLoading && chartData.length === 0

  return (
    <div
      className="rounded-2xl bg-[#0F1630]/80 border border-white/5 flex h-full min-h-0 min-w-0 w-full flex-col"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <TlpCardHeader title="ACC Progress Curve" icon={TrendingUp} tone="cyan" className="mb-2" />

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-red-300/90">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No data available</div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#B0B7C3", fontSize: 9 }}
                axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={52}
                tickMargin={4}
              />
              <YAxis
                tick={{ fill: "#A7B0C2", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b122b",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "10px",
                  color: "#ffffff",
                  fontSize: "11px",
                }}
                formatter={(value: unknown, name: string) => {
                  const n = typeof value === "number" ? value : 0
                  return [n.toLocaleString(), name]
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ paddingTop: 4 }}
                formatter={(value) => <span className="text-[9px] text-white/80">{value}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

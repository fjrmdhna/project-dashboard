"use client"

import { useMemo } from "react"
import { ClipboardList } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import type { AdminBottleneckItem } from "@/hooks/useTlpAdminBottleneck"

const WAITING_COLOR = "#F59E0B"
const DEFAULT_COLOR = "#60A5FA"
const OTHERS_COLOR = "rgba(255,255,255,0.22)"

function isWaitingStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s.includes("wait") || s.includes("waiting") || s.includes("approval") || s.includes("await")
}

function truncateLabel(label: string, max = 34): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

export function TlpAdminBottleneckCard({
  rows,
  total,
  isLoading = false,
  error,
}: {
  rows: AdminBottleneckItem[]
  total: number
  isLoading?: boolean
  error?: string | null
}) {
  const data = useMemo(() => {
    return (rows ?? []).map((r) => ({
      status: r.status,
      label: truncateLabel(r.status),
      count: r.count,
    }))
  }, [rows])

  return (
    <div
      className="rounded-2xl bg-[#0F1630]/80 border border-white/5 flex h-full min-h-0 min-w-0 w-full flex-col"
      style={{ padding: "calc(var(--wb-card-padding) - 4px)" }}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-lg bg-amber-500/20 p-1">
            <ClipboardList className="h-3.5 w-3.5 text-amber-200" />
          </div>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200 truncate">
            Administration Bottleneck
          </span>
        </div>
        <div className="text-[10px] text-white/60 whitespace-nowrap">
          Total: <span className="text-white/85 font-semibold">{total.toLocaleString()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/60">Loading...</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-red-300/90">{error}</div>
      ) : data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-white/50">No data available</div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#A7B0C2", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: "#B0B7C3", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b122b",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "10px",
                  color: "#ffffff",
                  fontSize: "11px",
                }}
                formatter={(value: unknown) => [Number(value).toLocaleString(), "Count"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.status ?? ""}
              />
              <Bar dataKey="count" radius={[6, 6, 6, 6]} isAnimationActive={false}>
                {data.map((entry) => {
                  const fill =
                    entry.status === "Others"
                      ? OTHERS_COLOR
                      : isWaitingStatus(entry.status)
                        ? WAITING_COLOR
                        : DEFAULT_COLOR
                  return <Cell key={entry.status} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}


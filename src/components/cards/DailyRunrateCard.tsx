"use client"

import { useMemo } from "react"
import { BarChart } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { DailyRunrateItem } from "@/hooks/useDailyRunrateData"
import { AopDailyRunrateItem } from "@/hooks/useAopDailyRunrateData"

const DEFAULT_DAILY_RUNRATE_TITLE = "Daily Runrate – Last 7 Days"

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

/** Compact axis labels — keeps Y-axis readable in narrow wallboard panels. */
function formatChartTick(value: number): string {
  const rounded = Math.round(value)
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`
  if (rounded >= 10_000) return `${Math.round(rounded / 1_000)}k`
  if (rounded >= 1_000) return `${(rounded / 1_000).toFixed(1)}k`
  return String(rounded)
}

function getSeriesValues(item: DailyRunrateItem | AopDailyRunrateItem, isAopFormat: boolean) {
  if (isAopFormat && "forecast" in item && "actual" in item) {
    return { primary: item.forecast ?? 0, secondary: item.actual ?? 0 }
  }
  if ("readiness" in item && "activated" in item) {
    return {
      primary: (item as DailyRunrateItem).readiness ?? 0,
      secondary: (item as DailyRunrateItem).activated ?? 0,
    }
  }
  return { primary: 0, secondary: 0 }
}

export interface DailyRunrateCardProps {
  data: DailyRunrateItem[] | AopDailyRunrateItem[]
  isLoading?: boolean
  /** Card header badge text */
  title?: string
  /** Optional class for the title badge (e.g. caf-subtitle on CAF dashboard) */
  titleClassName?: string
  /** Override legend/tooltip labels for forecast & actual series */
  seriesLabels?: {
    forecast?: string
    actual?: string
  }
  /** Hide value labels above chart points (cleaner on dense dashboards) */
  hidePointLabels?: boolean
  /** Tighter chart for wallboard footer panels */
  compact?: boolean
}

export function DailyRunrateCard({
  data,
  isLoading = false,
  title = DEFAULT_DAILY_RUNRATE_TITLE,
  titleClassName,
  seriesLabels,
  hidePointLabels = false,
  compact = false,
}: DailyRunrateCardProps) {
  const forecastLabel = seriesLabels?.forecast ?? 'Forecast'
  const actualLabel = seriesLabels?.actual ?? 'Actual'
  const titleBadgeClass =
    titleClassName ??
    "text-[10px] font-semibold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full"
  const legacyForecastLabel = seriesLabels?.forecast ?? "Readiness"
  const legacyActualLabel = seriesLabels?.actual ?? "Activated"

  const isAopFormat = data.length > 0 && ("forecast" in data[0] || "actual" in data[0])

  const { primaryTotal, secondaryTotal, yMax } = useMemo(() => {
    let primary = 0
    let secondary = 0
    let peak = 0

    for (const item of data) {
      const values = getSeriesValues(item, isAopFormat)
      primary += values.primary
      secondary += values.secondary
      peak = Math.max(peak, values.primary, values.secondary)
    }

    const paddedMax = peak > 0 ? Math.ceil(peak * 1.12) : 5
    return {
      primaryTotal: primary,
      secondaryTotal: secondary,
      yMax: paddedMax,
    }
  }, [data, isAopFormat])

  const showPointLabels = compact || !hidePointLabels
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A2340] border border-white/10 px-3 py-2 rounded-md text-xs">
          <p className="text-white/90 font-semibold mb-1">{label}</p>
          <div className="space-y-1">
            {isAopFormat ? (
              <>
                <p className="text-[#8A5AA3]">
                  <span className="text-white/80">{forecastLabel}: </span>
                  {formatCount(Number(payload[0]?.value ?? 0))}
                </p>
                <p className="text-[#7CB342]">
                  <span className="text-white/80">{actualLabel}: </span>
                  {formatCount(Number(payload[1]?.value ?? 0))}
                </p>
              </>
            ) : (
              <>
                <p className="text-[#8A5AA3]">
                  <span className="text-white/80">{legacyForecastLabel}: </span>
                  {formatCount(Number(payload[0]?.value ?? 0))}
                </p>
                <p className="text-[#7CB342]">
                  <span className="text-white/80">{legacyActualLabel}: </span>
                  {formatCount(Number(payload[1]?.value ?? 0))}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderPointLabel = (props: {
    x?: string | number
    y?: string | number
    value?: string | number
  }) => {
    const x = typeof props.x === "number" ? props.x : Number(props.x)
    const y = typeof props.y === "number" ? props.y : Number(props.y)
    const value = typeof props.value === "number" ? props.value : Number(props.value)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value) || value === 0) {
      return null
    }

    return (
      <text
        x={x}
        y={y - (compact ? 5 : 8)}
        fill="#FFFFFF"
        fontSize={compact ? 8 : 9}
        textAnchor="middle"
        style={{
          filter: "drop-shadow(0px 0px 1px rgba(0,0,0,0.7))",
          textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
        }}
      >
        {compact ? formatChartTick(value) : formatCount(value)}
      </text>
    )
  }

  const pointLabel = showPointLabels ? renderPointLabel : false
  const chartMargin = compact
    ? { top: 14, right: 8, left: 2, bottom: 2 }
    : { top: 12, right: 8, left: 0, bottom: 12 }
  const containerClass = compact
    ? "rounded-xl bg-[#0F1630]/80 border border-white/5 p-1.5 w-full h-full flex flex-col min-w-0"
    : "rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col min-w-0"
  const headerClass = compact ? "mb-1" : "mb-1.5"

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="bg-blue-500/20 p-1 rounded-md">
            <BarChart className="h-3 w-3 text-blue-400" />
          </div>
          <div className={titleBadgeClass}>
            {title}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          Loading...
        </div>
      </div>
    );
  }

  // Check if all data values are 0 (empty state)
  const hasNoData = data.length === 0 || data.every(item => {
    if ('forecast' in item && 'actual' in item) {
      return item.forecast === 0 && item.actual === 0
    }
    if ('readiness' in item && 'activated' in item) {
      return (item as any).readiness === 0 && (item as any).activated === 0
    }
    return true
  })

  // Empty state - when no runrate data for current filter
  if (hasNoData) {
    return (
      <div className="rounded-xl bg-[#0F1630]/80 border border-white/5 p-2 w-full h-full flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-shrink-0">
          <div className="bg-blue-500/20 p-1 rounded-md">
            <BarChart className="h-3 w-3 text-blue-400" />
          </div>
          <div className={titleBadgeClass}>
            {title}
          </div>
        </div>
        
        {/* Empty state message */}
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
          No runrate data for current filter
        </div>
      </div>
    )
  }
  
  const primarySeriesLabel = isAopFormat ? forecastLabel : legacyForecastLabel
  const secondarySeriesLabel = isAopFormat ? actualLabel : legacyActualLabel

  return (
    <div className={containerClass}>
      <div
        className={`flex flex-shrink-0 items-center justify-between gap-2 ${headerClass} ${
          compact ? "caf-runrate-header--compact" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="bg-blue-500/20 p-1 rounded-md">
            <BarChart className="h-3 w-3 text-blue-400" />
          </div>
          <div className={titleBadgeClass}>{title}</div>
        </div>

        {compact ? (
          <div className="caf-runrate-summary" aria-label="7-day totals">
            <span className="caf-runrate-summary__item caf-runrate-summary__item--forecast">
              <span className="caf-runrate-summary__dot" aria-hidden="true" />
              {primarySeriesLabel} {formatCount(primaryTotal)}
            </span>
            <span className="caf-runrate-summary__item caf-runrate-summary__item--actual">
              <span className="caf-runrate-summary__dot" aria-hidden="true" />
              {secondarySeriesLabel} {formatCount(secondaryTotal)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 flex flex-col min-h-0 caf-runrate-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#B0B7C3", fontSize: compact ? 8 : 8 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
              interval={compact ? 0 : 0}
              angle={compact ? 0 : -45}
              height={compact ? 22 : undefined}
              textAnchor={compact ? "middle" : "end"}
              tickMargin={compact ? 6 : 8}
            />
            <YAxis
              tick={{ fill: "#B0B7C3", fontSize: compact ? 8 : 8 }}
              axisLine={false}
              tickLine={false}
              width={compact ? 38 : 32}
              tickFormatter={formatChartTick}
              allowDecimals={false}
              domain={[0, yMax]}
              tickCount={compact ? 4 : 5}
            />
            <Tooltip content={<CustomTooltip />} />
            {!compact ? (
              <Legend
                verticalAlign="bottom"
                height={undefined}
                iconType="circle"
                iconSize={6}
                formatter={(value) => <span className="text-[10px] text-gray-300">{value}</span>}
                wrapperStyle={{ paddingTop: "5px" }}
              />
            ) : null}
            {isAopFormat ? (
              <>
                <Line 
                  type="monotone"
                  dataKey="forecast"
                  name={forecastLabel}
                  stroke="#8A5AA3"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#8A5AA3', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#8A5AA3', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  label={pointLabel}
                />
                <Line 
                  type="monotone"
                  dataKey="actual"
                  name={actualLabel}
                  stroke="#7CB342"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#7CB342', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#7CB342', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={1000}
                  label={pointLabel}
                />
              </>
            ) : (
              <>
                <Line 
                  type="monotone"
                  dataKey="readiness"
                  name={legacyForecastLabel}
                  stroke="#8A5AA3"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#8A5AA3', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#8A5AA3', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  label={pointLabel}
                />
                <Line 
                  type="monotone"
                  dataKey="activated"
                  name={legacyActualLabel}
                  stroke="#7CB342"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#7CB342', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#7CB342', stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={true}
                  animationDuration={1000}
                  label={pointLabel}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 

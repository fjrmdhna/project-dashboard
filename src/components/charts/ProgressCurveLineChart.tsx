"use client"

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

export type Row = {
  rfs_forecast_lock?: string | null; // forecast date
  imp_integ_af?: string | null;      // readiness date
  rfs_af?: string | null;            // activated date
  mocn_activation_forecast?: string | null; // plan 5G readiness date
};

export type ProgressCurveProps = {
  rows: Row[];                // HASIL FILTER dari FilterBar
  anchorDate?: string;        // ISO; default today
  monthsSpan?: 3 | 5;         // default 3 => prev, current, next
  className?: string;
};

// Utility functions for date manipulation
const toStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const toEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const clampRange = (s: Date, e: Date, min: Date, max: Date) => ({
  start: new Date(Math.max(+s, +min)),
  end: new Date(Math.min(+e, +max)),
});
const fmtMonth = (d: Date) => d.toLocaleString('en', { month: 'short' });
const addMonths = (d: Date, amount: number) => new Date(d.getFullYear(), d.getMonth() + amount, 1, 0, 0, 0, 0);
const safeDate = (v?: string | null) => {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(+d) ? undefined : d;
};

// Function to get the actual week number in the year
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
};

// Type for date buckets
type Bucket = { key: string; label: string; start: Date; end: Date; kind: 'month' | 'week' };

function buildHybridBuckets(anchorDate?: string, span: 3 | 5 = 3, rows: Row[] = []): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());

  const collectedDates = rows
    .flatMap((row) => [
      safeDate(row.rfs_forecast_lock),
      safeDate(row.imp_integ_af),
      safeDate(row.rfs_af),
      safeDate(row.mocn_activation_forecast),
    ])
    .filter((value): value is Date => Boolean(value));

  // Set September as the minimum start month
  const currentYear = anchor.getFullYear();
  const septemberStart = new Date(currentYear, 8, 1); // September is month 8 (0-indexed)
  
  const monthsBefore = Math.floor(span / 2);
  const monthsAfter = span - monthsBefore - 1;

  const baseRangeStart = toStart(addMonths(anchor, -monthsBefore));
  const baseRangeEnd = toEnd(addMonths(anchor, monthsAfter));

  // Ensure we don't start before September
  const adjustedBaseRangeStart = baseRangeStart < septemberStart ? septemberStart : baseRangeStart;

  const actualRangeStart = collectedDates.length
    ? toStart(new Date(Math.min(...collectedDates.map((d) => d.getTime()))))
    : adjustedBaseRangeStart;
  const actualRangeEnd = collectedDates.length
    ? toEnd(new Date(Math.max(...collectedDates.map((d) => d.getTime()))))
    : baseRangeEnd;

  // Ensure range start is not before September
  const rangeStart = actualRangeStart < septemberStart ? septemberStart : actualRangeStart;
  const rangeEnd = actualRangeEnd > baseRangeEnd ? actualRangeEnd : baseRangeEnd;

  const buckets: Bucket[] = [];
  let cursor = toStart(rangeStart);

  while (cursor <= rangeEnd) {
    const monthStart = toStart(cursor);
    const monthEnd = toEnd(cursor);
    const { start, end } = clampRange(monthStart, monthEnd, rangeStart, rangeEnd);

    if (start > end) {
      cursor = addMonths(cursor, 1);
      continue;
    }

    const isAnchorMonth =
      monthStart.getFullYear() === anchor.getFullYear() && monthStart.getMonth() === anchor.getMonth();

    if (isAnchorMonth) {
      buckets.push(...buildWeekBuckets(start, end, rangeStart, rangeEnd));
    } else {
      buckets.push({
        key: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
        label: fmtMonth(monthStart),
        start,
        end,
        kind: 'month',
      });
    }

    cursor = addMonths(cursor, 1);
  }

  return buckets;
}

function buildWeekBuckets(monthStart: Date, monthEnd: Date, rangeStart: Date, rangeEnd: Date): Bucket[] {
  const weeks: Bucket[] = [];
  let cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0);
    const weekEndWithinMonth = new Date(weekStart);
    weekEndWithinMonth.setDate(weekEndWithinMonth.getDate() + 6);
    weekEndWithinMonth.setHours(23, 59, 59, 999);

    const monthLimitedEnd = weekEndWithinMonth.getTime() > monthEnd.getTime() ? monthEnd : weekEndWithinMonth;
    const { start, end } = clampRange(weekStart, monthLimitedEnd, rangeStart, rangeEnd);

    if (start <= end) {
      const weekNumber = getWeekNumber(start);
      weeks.push({
        key: `${start.getFullYear()}-${start.getMonth() + 1}-w${weekNumber}`,
        label: `W${weekNumber}`,
        start,
        end,
        kind: 'week',
      });
    }

    const nextStart = new Date(weekStart);
    nextStart.setDate(nextStart.getDate() + 7);
    cursor = nextStart;
  }

  return weeks;
}

// Type for aggregated data points
type Point = {
  key: string;
  label: string;
  forecast: number | null;
  ready: number | null;
  active: number | null;
  planReadiness: number | null;
};

// Function to aggregate data into buckets with cumulative values
function aggregate(rows: Row[], buckets: Bucket[]): Point[] {
  if (!buckets.length) return [];

  const inRange = (val?: string | null, s?: Date, e?: Date) => {
    const d = safeDate(val);
    return !!(d && s && e && d >= s && d <= e);
  };

  const perBucket = buckets.map((bucket) => {
    const { start, end } = bucket;
    return {
      forecast: rows.reduce((total, row) => total + (inRange(row.rfs_forecast_lock, start, end) ? 1 : 0), 0),
      ready: rows.reduce((total, row) => total + (inRange(row.imp_integ_af, start, end) ? 1 : 0), 0),
      active: rows.reduce((total, row) => total + (inRange(row.rfs_af, start, end) ? 1 : 0), 0),
      planReadiness: rows.reduce(
        (total, row) => total + (inRange(row.mocn_activation_forecast, start, end) ? 1 : 0),
        0,
      ),
    };
  });

  let lastForecastIndex = -1;
  let lastReadyIndex = -1;
  let lastActiveIndex = -1;
  let lastPlanReadinessIndex = -1;

  perBucket.forEach((values, index) => {
    if (values.forecast > 0) lastForecastIndex = index;
    if (values.ready > 0) lastReadyIndex = index;
    if (values.active > 0) lastActiveIndex = index;
    if (values.planReadiness > 0) lastPlanReadinessIndex = index;
  });

  let cumulativeForecast = 0;
  let cumulativeReady = 0;
  let cumulativeActive = 0;
  let cumulativePlanReadiness = 0;

  return perBucket.map((values, index) => {
    cumulativeForecast += values.forecast;
    cumulativeReady += values.ready;
    cumulativeActive += values.active;
    cumulativePlanReadiness += values.planReadiness;

    return {
      key: buckets[index].key,
      label: buckets[index].label,
      forecast: index <= lastForecastIndex ? cumulativeForecast : null,
      ready: index <= lastReadyIndex ? cumulativeReady : null,
      active: index <= lastActiveIndex ? cumulativeActive : null,
      planReadiness: index <= lastPlanReadinessIndex ? cumulativePlanReadiness : null,
    };
  });
}

// Custom formatter for labels to handle null/undefined values
const valueFormatter = (value: any): string => {
  if (value === undefined || value === null) return '';
  const numValue = Number(value);
  return !isNaN(numValue) && numValue > 0 ? numValue.toLocaleString() : '';
};

// Custom dot with label for Forecast (Purple) - Label to the right of point
const ForecastDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.forecast;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null; // Don't render dot at all for null values
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#8A5AA3" />
      
      {/* Background rectangle with purple color - Right of point */}
      <rect
        x={cx + 6}
        y={cy - 6}
        width={16}
        height={12}
        fill="rgba(138, 90, 163, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx + 14}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  );
};

// Custom dot with label for Readiness (Red) - Label to the left of point
const ReadinessDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.ready;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null; // Don't render dot at all for null values
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#E53935" />
      
      {/* Background rectangle with red color - Left of point */}
      <rect
        x={cx - 22}
        y={cy - 6}
        width={16}
        height={12}
        fill="rgba(229, 57, 53, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx - 14}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  );
};

// Custom dot with label for Activated (Green) - Label above left of point
const ActivatedDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.active;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null; // Don't render dot at all for null values
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#7CB342" />
      
      {/* Background rectangle with green color - Above left of point */}
      <rect
        x={cx - 22}
        y={cy - 16}
        width={16}
        height={12}
        fill="rgba(124, 179, 66, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx - 14}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  );
};

// Custom dot with label for Plan 5G Readiness (Blue) - Label above right of point
const PlanReadinessDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.planReadiness;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null; // Don't render dot at all for null values
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#2196F3" />
      
      {/* Background rectangle with blue color - Above right of point */}
      <rect
        x={cx + 6}
        y={cy - 16}
        width={16}
        height={12}
        fill="rgba(33, 150, 243, 0.95)"
        rx={3}
        ry={3}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx + 14}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={8}
        fontWeight={600}
        style={{
          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,1))',
          textShadow: '0px 0px 3px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  );
};

// Main component
export default function ProgressCurveLineChart({ rows, anchorDate, monthsSpan = 3, className }: ProgressCurveProps) {
  // Memoize buckets and data to prevent unnecessary recalculations
  const buckets = useMemo(() => buildHybridBuckets(anchorDate, monthsSpan as 3|5, rows ?? []), [anchorDate, monthsSpan, rows]);
  const data = useMemo(() => aggregate(rows ?? [], buckets), [rows, buckets]);


  return (
    <div className={`rounded-lg bg-[#0F1630]/80 border border-white/5 p-0.5 w-full h-full flex flex-col min-w-0 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-1 mb-1 flex-shrink-0">
        <div className="bg-orange-500/20 p-0.5 rounded-sm">
          <TrendingUp className="h-2 w-2 text-orange-400" />
        </div>
        <div className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">
          Progress Curve
        </div>
      </div>
      
      {/* Chart - Flexible Height */}
      <div className="flex-1 flex flex-col min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 30, right: 30, left: 30, bottom: 5 }}>
            <CartesianGrid stroke="rgba(255,255,255,.06)" strokeDasharray="2 2" />
            <XAxis 
              dataKey="label" 
              tick={{ fill:'#B0B7C3', fontSize:6 }}
              height={15}
              tickMargin={2}
            />
            <YAxis 
              tick={{ fill:'#B0B7C3', fontSize:6 }} 
              allowDecimals={false}
              width={20}
            />
            <Tooltip 
              formatter={(value) => Number(value).toLocaleString()} 
              contentStyle={{ 
                backgroundColor: '#1A2035', 
                borderColor: 'rgba(255,255,255,0.1)',
                fontSize: '10px',
                padding: '6px 8px',
                borderRadius: '6px'
              }}
              labelStyle={{ 
                color: '#B0B7C3',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '2px'
              }}
            />
             <Line 
               dataKey="forecast" 
               name="Plan 5G Activated" 
               stroke="#8A5AA3" 
               strokeWidth={1} 
               dot={<ForecastDotWithLabel />}
               activeDot={{ r:2 }}
               isAnimationActive={false}
             />
             <Line 
               dataKey="ready" 
               name="Readiness" 
               stroke="#E53935" 
               strokeWidth={0.8} 
               dot={<ReadinessDotWithLabel />}
               isAnimationActive={false}
             />
             <Line 
               dataKey="active" 
               name="Activated" 
               stroke="#7CB342" 
               strokeWidth={0.8} 
               dot={<ActivatedDotWithLabel />}
               isAnimationActive={false}
             />
             <Line 
               dataKey="planReadiness" 
               name="Plan 5G Readiness" 
               stroke="#2196F3" 
               strokeWidth={0.8} 
               dot={<PlanReadinessDotWithLabel />}
               isAnimationActive={false}
             />
            <Legend verticalAlign="bottom" align="center" wrapperStyle={{ marginTop: 0, paddingTop: 0 }} iconType="circle" iconSize={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 

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
type Bucket = { key: string; label: string; start: Date; end: Date };

// Function to build hybrid buckets (all months with data)
function buildHybridBuckets(anchorDate?: string, span: 3|5 = 3, rows: Row[] = []): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());
  
  // Extract all dates from the data
  const allDates: Date[] = [];
  
  rows.forEach(row => {
    // Add all date fields to the collection
    const dates = [
      row.rfs_forecast_lock,
      row.imp_integ_af,
      row.rfs_af,
      row.mocn_activation_forecast
    ];
    
    dates.forEach(dateStr => {
      if (dateStr) {
        const date = safeDate(dateStr);
        if (date) {
          allDates.push(date);
        }
      }
    });
  });
  
  // If no data, fallback to hardcoded range
  if (allDates.length === 0) {
    const startMonth = new Date(2025, 8, 1); // September 2025
    const endMonth = new Date(2026, 1, 1);   // February 2026
    
    let currentMonth = new Date(startMonth);
    while (currentMonth <= endMonth) {
      allDates.push(new Date(currentMonth));
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    }
  }
  
  // Get min and max dates from actual data
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date(2025, 8, 1);
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(2026, 1, 1);
  
  // Create months array from min to max date
  const months: Date[] = [];
  const startMonth = toStart(minDate);
  const endMonth = toStart(maxDate);
  
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    months.push(new Date(currentMonth));
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const buckets: Bucket[] = [];
  months.forEach((m) => {
    const start = toStart(m), end = toEnd(m);
    const isCurrent = start.getMonth() === anchor.getMonth() && start.getFullYear() === anchor.getFullYear();
    
    // For current month (anchor month), use weekly breakdown if it has data
    // For other months, use monthly view
    const isCurrentMonth = start.getMonth() === anchor.getMonth() && start.getFullYear() === anchor.getFullYear();
    const hasDataInCurrentMonth = allDates.some(d => 
      d.getMonth() === start.getMonth() && d.getFullYear() === start.getFullYear()
    );
    
    if (isCurrentMonth && hasDataInCurrentMonth) {
      const ranges = [
        { 
          s: new Date(start), 
          e: new Date(start.getFullYear(), start.getMonth(), 7, 23, 59, 59, 999) 
        },
        { 
          s: new Date(start.getFullYear(), start.getMonth(), 8), 
          e: new Date(start.getFullYear(), start.getMonth(), 14, 23, 59, 59, 999) 
        },
        { 
          s: new Date(start.getFullYear(), start.getMonth(), 15), 
          e: new Date(start.getFullYear(), start.getMonth(), 21, 23, 59, 59, 999) 
        },
        { 
          s: new Date(start.getFullYear(), start.getMonth(), 22), 
          e: new Date(end) 
        },
      ];
      
      ranges.forEach((r, i) => {
        const { start: s, end: e } = clampRange(r.s, r.e, start, end);
        // Menghitung nomor minggu aktual dalam tahun
        const weekNumber = getWeekNumber(s);
        buckets.push({ 
          key: `${start.getFullYear()}-${start.getMonth()+1}-W${weekNumber}`, 
          label: `W${weekNumber}-${fmtMonth(start)}`, 
          start: s, 
          end: e 
        });
      });
    } else {
      // Monthly view for other months
      buckets.push({ 
        key: `${start.getFullYear()}-${start.getMonth()+1}`, 
        label: fmtMonth(start), 
        start, 
        end 
      });
    }
  });
  
  return buckets;
}

// Type for aggregated data points
type Point = { key: string; label: string; forecast: number | null; ready: number | null; active: number | null; planReadiness: number | null };

// Hardcoded data for Plan 5G Readiness and Plan 5G Activated
const hardcodedData = [
  { label: "W36-Sep", planReadiness: 0, forecast: 0 },
  { label: "W37-Sep", planReadiness: 20, forecast: 0 },
  { label: "W38-Sep", planReadiness: 300, forecast: 15 },
  { label: "W39-Sep", planReadiness: 650, forecast: 300 },
  { label: "W40-Sep", planReadiness: 1050, forecast: 1018 },
  { label: "Oct", planReadiness: 3671, forecast: 3255 },
  { label: "Nov", planReadiness: 6140, forecast: 5613 },
  { label: "Dec", planReadiness: 7336, forecast: 7334 },
  { label: "Jan", planReadiness: 7355, forecast: 7346 },
  { label: "Feb", planReadiness: 7386, forecast: 7386 }
];

// Function to aggregate data into buckets with cumulative values
function aggregate(rows: Row[], buckets: Bucket[]): Point[] {
  const inRange = (val?: string | null, s?: Date, e?: Date) => {
    const d = safeDate(val);
    return !!(d && s && e && d >= s && d <= e);
  };
  
  // First, calculate individual bucket values for actual data (ready and active)
  const bucketData = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    ready: rows.reduce((n, r) => n + (inRange(r.imp_integ_af, b.start, b.end) ? 1 : 0), 0),
    active: rows.reduce((n, r) => n + (inRange(r.rfs_af, b.start, b.end) ? 1 : 0), 0),
  }));
  
  // Find the last bucket that has any data for actual metrics
  let lastReadyIndex = -1;
  let lastActiveIndex = -1;
  
  for (let i = bucketData.length - 1; i >= 0; i--) {
    if (bucketData[i].ready > 0 && lastReadyIndex === -1) {
      lastReadyIndex = i;
    }
    if (bucketData[i].active > 0 && lastActiveIndex === -1) {
      lastActiveIndex = i;
    }
  }
  
  // Find the overall last data index for actual data
  const lastDataIndex = Math.max(lastReadyIndex, lastActiveIndex);
  
  // If no actual data found, use hardcoded data only
  if (lastDataIndex === -1) {
    return hardcodedData.map((item, index) => ({
      key: `hardcoded-${index}`,
      label: item.label,
      forecast: item.forecast,
      ready: null,
      active: null,
      planReadiness: item.planReadiness,
    }));
  }
  
  // Trim to only include buckets up to the last data point for actual data
  const trimmedBuckets = bucketData.slice(0, lastDataIndex + 1);
  
  // Make actual data cumulative
  let cumulativeReady = 0;
  let cumulativeActive = 0;
  
  const actualData = trimmedBuckets.map((bucket, index) => {
    cumulativeReady += bucket.ready;
    cumulativeActive += bucket.active;
    
    const ready = index <= lastReadyIndex ? cumulativeReady : null;
    const active = index <= lastActiveIndex ? cumulativeActive : null;
    
    return {
      key: bucket.key,
      label: bucket.label,
      ready,
      active,
    };
  });
  
  // Combine hardcoded data with actual data
  // Use hardcoded labels but merge with actual data where available
  return hardcodedData.map((hardcodedItem, index) => {
    // Find matching actual data by label or use null
    const actualItem = actualData.find(actual => 
      actual.label === hardcodedItem.label || 
      actual.label.includes(hardcodedItem.label.split('-')[0]) // Match by month
    );
    
    return {
      key: `combined-${index}`,
      label: hardcodedItem.label,
      forecast: hardcodedItem.forecast, // Plan 5G Activated (hardcoded)
      ready: actualItem?.ready || null, // Actual Readiness
      active: actualItem?.active || null, // Actual Activated
      planReadiness: hardcodedItem.planReadiness, // Plan 5G Readiness (hardcoded)
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
      <div className="flex items-center gap-0.5 mb-0 flex-shrink-0">
        <div className="bg-orange-500/20 p-0.5 rounded-sm">
          <TrendingUp className="h-2 w-2 text-orange-400" />
        </div>
        <div className="text-[8px] font-medium bg-orange-500/20 text-orange-300 px-0.5 py-0.5 rounded-full">
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

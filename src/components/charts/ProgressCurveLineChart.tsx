"use client"

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

export type Row = {
  rfs_forecast_lock?: string | null; // forecast date
  imp_integ_af?: string | null;      // readiness date
  rfs_af?: string | null;            // activated date
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
function buildHybridBuckets(anchorDate?: string, span: 3|5 = 3): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());
  const months: Date[] = [];
  
  // Create buckets for all months from September 2025 to February 2026
  // Based on actual data in database
  const startMonth = new Date(2025, 8, 1); // September 2025
  const endMonth = new Date(2026, 1, 1);   // February 2026
  
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    months.push(new Date(currentMonth));
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const buckets: Bucket[] = [];
  months.forEach((m) => {
    const start = toStart(m), end = toEnd(m);
    const isCurrent = start.getMonth() === anchor.getMonth() && start.getFullYear() === anchor.getFullYear();
    
    // For September 2025 (current month), use weekly breakdown
    // For other months, use monthly view
    if (start.getFullYear() === 2025 && start.getMonth() === 8) { // September 2025
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
type Point = { key: string; label: string; forecast: number; ready: number; active: number };

// Function to aggregate data into buckets
function aggregate(rows: Row[], buckets: Bucket[]): Point[] {
  const inRange = (val?: string | null, s?: Date, e?: Date) => {
    const d = safeDate(val);
    return !!(d && s && e && d >= s && d <= e);
  };
  
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    forecast: rows.reduce((n, r) => n + (inRange(r.rfs_forecast_lock, b.start, b.end) ? 1 : 0), 0),
    ready: rows.reduce((n, r) => n + (inRange(r.imp_integ_af, b.start, b.end) ? 1 : 0), 0),
    active: rows.reduce((n, r) => n + (inRange(r.rfs_af, b.start, b.end) ? 1 : 0), 0),
  }));
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
  
  // Don't render if value is 0 or empty
  if (!value || value === '0' || value === '') {
    return <circle cx={cx} cy={cy} r={4} fill="#8A5AA3" />;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={4} fill="#8A5AA3" />
      
      {/* Background rectangle with purple color - Right of point */}
      <rect
        x={cx + 8}
        y={cy - 8}
        width={20}
        height={16}
        fill="rgba(138, 90, 163, 0.95)"
        rx={4}
        ry={4}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx + 18}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={10}
        fontWeight={700}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))',
          textShadow: '0px 0px 4px rgba(0,0,0,1)'
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
  
  // Don't render if value is 0 or empty
  if (!value || value === '0' || value === '') {
    return <circle cx={cx} cy={cy} r={4} fill="#E53935" />;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={4} fill="#E53935" />
      
      {/* Background rectangle with red color - Left of point */}
      <rect
        x={cx - 28}
        y={cy - 8}
        width={20}
        height={16}
        fill="rgba(229, 57, 53, 0.95)"
        rx={4}
        ry={4}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx - 18}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={10}
        fontWeight={700}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))',
          textShadow: '0px 0px 4px rgba(0,0,0,1)'
        }}
      >
        {Number(value).toLocaleString()}
      </text>
    </g>
  );
};

// Custom dot with label for Activated (Green) - Label above point
const ActivatedDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.active;
  
  // Don't render if value is 0 or empty
  if (!value || value === '0' || value === '') {
    return <circle cx={cx} cy={cy} r={4} fill="#7CB342" />;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={4} fill="#7CB342" />
      
      {/* Background rectangle with green color - Above point */}
      <rect
        x={cx - 10}
        y={cy - 20}
        width={20}
        height={16}
        fill="rgba(124, 179, 66, 0.95)"
        rx={4}
        ry={4}
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.9))'
        }}
      />
      {/* Text label */}
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={10}
        fontWeight={700}
        style={{
          filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))',
          textShadow: '0px 0px 4px rgba(0,0,0,1)'
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
  const buckets = useMemo(() => buildHybridBuckets(anchorDate, monthsSpan as 3|5), [anchorDate, monthsSpan]);
  const data = useMemo(() => aggregate(rows ?? [], buckets), [rows, buckets]);


  return (
    <div className={`rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-orange-500/20 p-1.5 rounded-lg">
          <TrendingUp className="h-4 w-4 text-orange-400" />
        </div>
        <div className="text-xs font-medium bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
          Progress Curve
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="3 3" />
            <XAxis 
              dataKey="label" 
              tick={{ fill:'#B0B7C3', fontSize:12 }}
              height={40}
              tickMargin={10}
            />
            <YAxis 
              tick={{ fill:'#B0B7C3', fontSize:12 }} 
              allowDecimals={false}
              width={50}
            />
            <Tooltip 
              formatter={(value) => Number(value).toLocaleString()} 
              contentStyle={{ backgroundColor: '#1A2035', borderColor: 'rgba(255,255,255,0.1)' }}
              labelStyle={{ color: '#B0B7C3' }}
            />
             <Line 
               dataKey="forecast" 
               name="Forecast Accelerate" 
               stroke="#8A5AA3" 
               strokeWidth={3} 
               dot={<ForecastDotWithLabel />}
               activeDot={{ r:5 }}
               isAnimationActive={false}
             />
             <Line 
               dataKey="ready" 
               name="Readiness" 
               stroke="#E53935" 
               strokeWidth={2} 
               dot={<ReadinessDotWithLabel />}
               isAnimationActive={false}
             />
             <Line 
               dataKey="active" 
               name="Activated" 
               stroke="#7CB342" 
               strokeWidth={2} 
               dot={<ActivatedDotWithLabel />}
               isAnimationActive={false}
             />
            <Legend 
              verticalAlign="bottom" 
              align="center" 
              wrapperStyle={{ paddingTop: 8 }}
              iconType="circle"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 
"use client"

import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, LabelList } from 'recharts';

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

// Function to build hybrid buckets (prev month, current month by weeks, next month)
function buildHybridBuckets(anchorDate?: string, span: 3|5 = 3): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());
  const months: Date[] = [];
  
  if (span === 3) months.push(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  if (span === 5) months.push(
    new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1),
    new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)
  );
  
  months.push(anchor);
  
  if (span === 3) months.push(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  if (span === 5) months.push(
    new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
    new Date(anchor.getFullYear(), anchor.getMonth() + 2, 1)
  );

  const buckets: Bucket[] = [];
  months.forEach((m) => {
    const start = toStart(m), end = toEnd(m);
    const isCurrent = start.getMonth() === anchor.getMonth() && start.getFullYear() === anchor.getFullYear();
    
    if (!isCurrent) {
      buckets.push({ 
        key: `${start.getFullYear()}-${start.getMonth()+1}`, 
        label: fmtMonth(start), 
        start, 
        end 
      });
    } else {
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

// Main component
export default function ProgressCurveLineChart({ rows, anchorDate, monthsSpan = 3, className }: ProgressCurveProps) {
  // Memoize buckets and data to prevent unnecessary recalculations
  const buckets = useMemo(() => buildHybridBuckets(anchorDate, monthsSpan as 3|5), [anchorDate, monthsSpan]);
  const data = useMemo(() => aggregate(rows ?? [], buckets), [rows, buckets]);

  // Debug log
  console.log("ProgressCurveLineChart data:", data);

  return (
    <div className={`rounded-2xl bg-[#0F1630]/80 border border-white/5 p-4 w-full h-full flex flex-col ${className ?? ''}`}>
      <div className="text-lg font-semibold text-white mb-2">Progress Curve</div>
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
              dot={{ r:4, fill:'#8A5AA3' }} 
              activeDot={{ r:5 }}
              isAnimationActive={false}
            >
              <LabelList 
                dataKey="forecast" 
                position="right" 
                formatter={valueFormatter} 
                fill="#fff" 
                fontSize={11} 
              />
            </Line>
            <Line 
              dataKey="ready" 
              name="Readiness" 
              stroke="#E53935" 
              strokeWidth={2} 
              dot={{ r:4, fill:'#E53935' }}
              isAnimationActive={false}
            >
              <LabelList 
                dataKey="ready" 
                position="left" 
                formatter={valueFormatter} 
                fill="#fff" 
                fontSize={11} 
              />
            </Line>
            <Line 
              dataKey="active" 
              name="Activated" 
              stroke="#7CB342" 
              strokeWidth={2} 
              dot={{ r:4, fill:'#7CB342' }}
              isAnimationActive={false}
            >
              <LabelList 
                dataKey="active" 
                position="top" 
                formatter={valueFormatter} 
                fill="#fff" 
                fontSize={11} 
              />
            </Line>
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
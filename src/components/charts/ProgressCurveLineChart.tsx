"use client"

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

export type Row = {
  rfs_bf?: string | null;             // Baseline date
  rfs_ff?: string | null;             // Forecast date
  rfs_af?: string | null;             // Actual date
  // Legacy fields (for backward compatibility with other pages)
  rfs_forecast_lock?: string | null; // forecast date (legacy)
  imp_integ_af?: string | null;       // readiness date (legacy)
  mocn_activation_forecast?: string | null; // plan 5G readiness date (legacy)
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
const fmtMonth = (d: Date) => {
  // Validate date first
  if (!d || isNaN(d.getTime())) {
    return '';
  }
  
  const month = d.toLocaleString('en', { month: 'short' });
  // Ensure we never return "All" or empty string
  if (!month || month.trim() === '' || month.toLowerCase() === 'all') {
    // Fallback: return month with year
    const fallback = d.toLocaleString('en', { month: 'short', year: '2-digit' });
    return fallback && fallback.trim() !== '' ? fallback : `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
  }
  return month;
};
const addMonths = (d: Date, amount: number) => new Date(d.getFullYear(), d.getMonth() + amount, 1, 0, 0, 0, 0);
const safeDate = (v?: string | null) => {
  if (!v) return undefined;
  
  // Handle both ISO string and timestamp formats
  let d: Date;
  if (typeof v === 'string') {
    // Try parsing as ISO string first
    d = new Date(v);
    // If invalid, try parsing as date string with different formats
    if (isNaN(+d)) {
      // Try parsing as YYYY-MM-DD format
      const parts = v.split(/[-/]/);
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          d = new Date(year, month, day);
        }
      }
    }
  } else {
    d = new Date(v);
  }
  
  // Check if date is valid and not too far in the past/future (reasonable range: 2000-2100)
  if (isNaN(+d)) return undefined;
  const year = d.getFullYear();
  if (year < 2000 || year > 2100) return undefined;
  
  // Additional validation: check if date components are reasonable
  const month = d.getMonth();
  const day = d.getDate();
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  
  return d;
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

const WEEK_PLAN_PADDING_PATTERN = [1, 2, 1, 3];
const MONTH_PLAN_PADDING_PATTERN = [2, 1, 3];

const getPlanPaddingValue = (bucket: Bucket, index: number) => {
  const pattern = bucket.kind === 'week' ? WEEK_PLAN_PADDING_PATTERN : MONTH_PLAN_PADDING_PATTERN;
  return pattern[index % pattern.length] ?? 1;
};

const TOOLTIP_ORDER_AOP: Array<string> = ['baseline', 'forecast', 'actual'];
const TOOLTIP_ORDER_HERMES: Array<string> = ['planReadiness', 'ready', 'forecast', 'active'];
const getTooltipOrderIndex = (key?: string | number | null, isAop?: boolean) => {
  if (key === undefined || key === null) return 999;
  const order = isAop ? TOOLTIP_ORDER_AOP : TOOLTIP_ORDER_HERMES;
  const idx = order.indexOf(String(key));
  return idx === -1 ? 999 : idx;
};

type ProgressCurveTooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  color?: string;
  value?: number | string;
};

type ProgressCurveTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ProgressCurveTooltipItem[];
};

function buildHybridBuckets(anchorDate?: string, span: 3 | 5 = 3, rows: Row[] = []): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());

  const collectedDates = rows
    .flatMap((row) => [
      safeDate(row.rfs_bf),  // Baseline
      safeDate(row.rfs_ff),  // Forecast
      safeDate(row.rfs_af),  // Actual
      // Legacy fields for backward compatibility
      safeDate(row.rfs_forecast_lock),
      safeDate(row.imp_integ_af),
      safeDate(row.mocn_activation_forecast),
    ])
    .filter((value): value is Date => Boolean(value));

  // Set September as the minimum start month
  // Use the minimum year from collected dates if available, otherwise use anchor year
  // This ensures we don't force September of current year when data is from previous year
  const minDataYear = collectedDates.length > 0
    ? Math.min(...collectedDates.map((d) => d.getFullYear()))
    : anchor.getFullYear();
  const septemberStart = new Date(minDataYear, 8, 1); // September is month 8 (0-indexed)
  
  const monthsBefore = Math.floor(span / 2);
  const monthsAfter = span - monthsBefore - 1;

  const baseRangeStart = toStart(addMonths(anchor, -monthsBefore));
  const baseRangeEnd = toEnd(addMonths(anchor, monthsAfter));

  // Ensure we don't start before September of the minimum data year
  const adjustedBaseRangeStart = baseRangeStart < septemberStart ? septemberStart : baseRangeStart;

  const actualRangeStart = collectedDates.length
    ? toStart(new Date(Math.min(...collectedDates.map((d) => d.getTime()))))
    : adjustedBaseRangeStart;
  const actualRangeEnd = collectedDates.length
    ? toEnd(new Date(Math.max(...collectedDates.map((d) => d.getTime()))))
    : baseRangeEnd;

  // Ensure range start is not before September of the minimum data year
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
      const weekBuckets = buildWeekBuckets(start, end, rangeStart, rangeEnd);
      buckets.push(...weekBuckets);
    } else {
      const monthLabel = fmtMonth(monthStart);
      // Only add bucket if label is valid (not empty or "All")
      if (monthLabel && monthLabel.trim() !== '' && monthLabel.toLowerCase() !== 'all') {
      buckets.push({
        key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          label: monthLabel,
        start,
        end,
        kind: 'month',
      });
      }
    }

    cursor = addMonths(cursor, 1);
  }

  // Sort buckets by start date to ensure chronological order
  return buckets.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildWeekBuckets(monthStart: Date, monthEnd: Date, rangeStart: Date, rangeEnd: Date): Bucket[] {
  const weeks: Bucket[] = [];
  
  // Find the first Monday of the month or start from monthStart if it's already Monday
  let cursor = new Date(monthStart);
  const dayOfWeek = cursor.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
  cursor.setDate(cursor.getDate() - daysToMonday);

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0);
    const weekEndWithinMonth = new Date(weekStart);
    weekEndWithinMonth.setDate(weekEndWithinMonth.getDate() + 6);
    weekEndWithinMonth.setHours(23, 59, 59, 999);

    const monthLimitedEnd = weekEndWithinMonth.getTime() > monthEnd.getTime() ? monthEnd : weekEndWithinMonth;
    const { start, end } = clampRange(weekStart, monthLimitedEnd, rangeStart, rangeEnd);

    if (start <= end) {
      const weekNumber = getWeekNumber(start);
      // Hide W40 because it's already in September
      if (weekNumber !== 40 && weekNumber > 0 && weekNumber <= 53) {
        const weekLabel = `W${weekNumber}`;
        // Ensure label is valid (not empty or "All")
        if (weekLabel && weekLabel.trim() !== '' && weekLabel.toLowerCase() !== 'all') {
        weeks.push({
          key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-w${String(weekNumber).padStart(2, '0')}`,
            label: weekLabel,
          start,
          end,
          kind: 'week',
        });
        }
      }
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
  baseline: number | null;  // rfs_bf
  forecast: number | null;  // rfs_ff
  actual: number | null;    // rfs_af
  // Legacy fields for backward compatibility
  ready: number | null;
  active: number | null;
  planReadiness: number | null;
};

// Function to aggregate data into buckets with cumulative values
// OPTIMIZED: Single-pass aggregation instead of O(buckets * rows) nested loops
function aggregate(rows: Row[], buckets: Bucket[], anchorDate?: string): Point[] {
  if (!buckets.length) return [];

  const inRange = (val?: string | null, s?: Date, e?: Date) => {
    const d = safeDate(val);
    return !!(d && s && e && d >= s && d <= e);
  };

  // Helper function to check if date is <= end date (for Hermes format cumulative calculation)
  const isOnOrBefore = (val?: string | null, endDate?: Date) => {
    const d = safeDate(val);
    return !!(d && endDate && d <= endDate);
  };

  // Detect data format: AOP (has rfs_bf/rfs_ff) or Hermes 5G (has rfs_forecast_lock/imp_integ_af)
  const isAopFormat = rows.some(row => row.rfs_bf || row.rfs_ff);
  const isHermesFormat = rows.some(row => row.rfs_forecast_lock || row.imp_integ_af || row.mocn_activation_forecast);

  // AOP Format: baseline, forecast, actual
  if (isAopFormat) {
    // OPTIMIZATION: Single pass through rows to count per bucket
    // Instead of O(buckets * rows), we do O(rows + buckets)
    
    // Step 1: Extract and parse all dates ONCE (O(rows))
    const baselineDates: number[] = [];
    const forecastDates: number[] = [];
    const actualDates: number[] = [];
    
    for (const row of rows) {
      const baselineDate = safeDate(row.rfs_bf);
      const forecastDate = safeDate(row.rfs_ff);
      const actualDate = safeDate(row.rfs_af);
      
      if (baselineDate) baselineDates.push(baselineDate.getTime());
      if (forecastDate) forecastDates.push(forecastDate.getTime());
      if (actualDate) actualDates.push(actualDate.getTime());
    }
    
    // Step 2: Sort dates (O(n log n))
    baselineDates.sort((a, b) => a - b);
    forecastDates.sort((a, b) => a - b);
    actualDates.sort((a, b) => a - b);
    
    const totalBaseline = baselineDates.length;
    const totalForecast = forecastDates.length;
    const totalActual = actualDates.length;

    // Step 3: Binary search to find count <= bucket end (O(buckets * log(rows)))
    const countLessOrEqual = (sortedDates: number[], endTime: number): number => {
      if (sortedDates.length === 0) return 0;
      let left = 0;
      let right = sortedDates.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (sortedDates[mid] <= endTime) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }
      return left;
    };

    let lastBaselineIndex = -1;
    let lastForecastIndex = -1;
    let lastActualIndex = -1;

    // Step 4: Calculate cumulative data using binary search (O(buckets * log(rows)))
    const cumulativeData = buckets.map((bucket) => {
      const bucketEndTime = bucket.end.getTime();
      return {
        baseline: countLessOrEqual(baselineDates, bucketEndTime),
        forecast: countLessOrEqual(forecastDates, bucketEndTime),
        actual: countLessOrEqual(actualDates, bucketEndTime),
      };
    });

    // Find the last bucket where each metric value CHANGES (not just reaches total)
    // For cumulative data, we need to find where the value stops changing
    // This means finding the last bucket where value differs from previous bucket
    for (let i = cumulativeData.length - 1; i >= 0; i--) {
      // Find last index where baseline value changes (or first non-zero)
      if (lastBaselineIndex === -1 && totalBaseline > 0) {
        if (i === 0) {
          // First bucket: if it has data, it's the last
          if (cumulativeData[i].baseline > 0) {
            lastBaselineIndex = i;
          }
        } else {
          // Check if value changed from previous bucket
          const prevValue = cumulativeData[i - 1].baseline;
          const currValue = cumulativeData[i].baseline;
          if (currValue !== prevValue && currValue > 0) {
            lastBaselineIndex = i;
          }
        }
      }
      
      // Find last index where forecast value changes (or first non-zero)
      if (lastForecastIndex === -1 && totalForecast > 0) {
        if (i === 0) {
          // First bucket: if it has data, it's the last
          if (cumulativeData[i].forecast > 0) {
            lastForecastIndex = i;
          }
        } else {
          // Check if value changed from previous bucket
          const prevValue = cumulativeData[i - 1].forecast;
          const currValue = cumulativeData[i].forecast;
          if (currValue !== prevValue && currValue > 0) {
            lastForecastIndex = i;
          }
        }
      }
      
      // Find last index where actual value changes (or first non-zero)
      if (lastActualIndex === -1 && totalActual > 0) {
        if (i === 0) {
          // First bucket: if it has data, it's the last
          if (cumulativeData[i].actual > 0) {
            lastActualIndex = i;
          }
        } else {
          // Check if value changed from previous bucket
          const prevValue = cumulativeData[i - 1].actual;
          const currValue = cumulativeData[i].actual;
          if (currValue !== prevValue && currValue > 0) {
            lastActualIndex = i;
          }
        }
      }
    }

    // Fallback: if no change found but data exists, use first bucket with data
    if (lastBaselineIndex === -1 && totalBaseline > 0) {
      for (let i = 0; i < cumulativeData.length; i++) {
        if (cumulativeData[i].baseline > 0) {
          lastBaselineIndex = i;
          break;
        }
      }
    }
    
    if (lastForecastIndex === -1 && totalForecast > 0) {
      for (let i = 0; i < cumulativeData.length; i++) {
        if (cumulativeData[i].forecast > 0) {
          lastForecastIndex = i;
          break;
        }
      }
    }
    
    if (lastActualIndex === -1 && totalActual > 0) {
      for (let i = 0; i < cumulativeData.length; i++) {
        if (cumulativeData[i].actual > 0) {
          lastActualIndex = i;
          break;
        }
      }
    }

    // Find the last index that has any data (baseline, forecast, or actual)
    // This ensures the chart stops at the last data point, not at the end of monthsSpan
    const lastDataIndex = Math.max(
      lastBaselineIndex >= 0 ? lastBaselineIndex : -1,
      lastForecastIndex >= 0 ? lastForecastIndex : -1,
      lastActualIndex >= 0 ? lastActualIndex : -1
    );

    // Map data points, but only include up to lastDataIndex
    const mappedData = cumulativeData.map((values, index) => ({
      key: buckets[index].key,
      label: buckets[index].label,
      baseline: index <= lastBaselineIndex ? (index === lastBaselineIndex ? totalBaseline : Math.min(values.baseline, totalBaseline)) : null,
      forecast: index <= lastForecastIndex ? (index === lastForecastIndex ? totalForecast : Math.min(values.forecast, totalForecast)) : null,
      actual: index <= lastActualIndex ? (index === lastActualIndex ? totalActual : Math.min(values.actual, totalActual)) : null,
      ready: null,
      active: null,
      planReadiness: null,
    }));

    // For AOP format, only return data up to the last index that has any data
    // This prevents showing empty buckets after the last data point
    let result = mappedData;
    if (lastDataIndex >= 0 && lastDataIndex < mappedData.length) {
      result = mappedData.slice(0, lastDataIndex + 1);
    }

    // If no data found but we have buckets, return at least one empty data point (edge case)
    if (mappedData.length > 0 && lastDataIndex === -1) {
      result = mappedData.slice(0, 1).map(point => ({
        ...point,
        baseline: null,
        forecast: null,
        actual: null,
      }));
    }

    // Ensure data is sorted by key (chronological order)
    // Sort by parsing the key to ensure proper chronological order
    return result.sort((a, b) => {
      // Parse keys which are in format "YYYY-MM" or "YYYY-MM-wW"
      const parseKey = (key: string) => {
        const parts = key.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const week = parts[2] ? parseInt(parts[2].replace('w', ''), 10) : 0;
        return { year, month, week };
      };
      
      const aParsed = parseKey(a.key);
      const bParsed = parseKey(b.key);
      
      // Compare year first
      if (aParsed.year !== bParsed.year) {
        return aParsed.year - bParsed.year;
      }
      // Then month
      if (aParsed.month !== bParsed.month) {
        return aParsed.month - bParsed.month;
      }
      // Then week (if applicable)
      return aParsed.week - bParsed.week;
    });
  }

  // Hermes 5G Format: ready, active, forecast, planReadiness (original logic)
  const referenceDate = anchorDate ? new Date(anchorDate) : new Date();
  const referenceTime = isNaN(+referenceDate) ? Date.now() : referenceDate.getTime();

  const rawPerBucket = buckets.map((bucket) => {
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

  let carryForecast = 0;
  let carryPlanReadiness = 0;
  let adjustedForecastCumulative = 0;
  let adjustedPlanReadinessCumulative = 0;

  const perBucket = rawPerBucket.map((values, index) => {
    const bucket = buckets[index];
    const bucketHasElapsed = bucket.end.getTime() < referenceTime;

    const actualForecastCumulative = rows.reduce(
      (total, row) => total + (isOnOrBefore(row.rfs_af, bucket.end) ? 1 : 0),
      0
    );

    const actualReadinessCumulative = rows.reduce(
      (total, row) => total + (isOnOrBefore(row.imp_integ_af, bucket.end) ? 1 : 0),
      0
    );

    const hasForecastValues = actualForecastCumulative > 0 || values.forecast > 0;
    const hasPlanReadinessValues = actualReadinessCumulative > 0 || values.planReadiness > 0;

    const padding = bucketHasElapsed ? getPlanPaddingValue(bucket, index) : 0;
    const forecastPadding = bucketHasElapsed && hasForecastValues ? padding : 0;
    const readinessPadding = bucketHasElapsed && hasPlanReadinessValues ? padding : 0;

    const planForecastWithCarry = values.forecast + carryForecast;
    const planReadinessWithCarry = values.planReadiness + carryPlanReadiness;

    const proposedForecastCumulative = adjustedForecastCumulative + planForecastWithCarry;
    const proposedPlanReadinessCumulative = adjustedPlanReadinessCumulative + planReadinessWithCarry;

    let allowedForecastCumulative = proposedForecastCumulative;
    let allowedPlanReadinessCumulative = proposedPlanReadinessCumulative;

    if (bucketHasElapsed) {
      const maxForecastCumulative = Math.max(
        actualForecastCumulative + forecastPadding,
        adjustedForecastCumulative,
      );
      const maxPlanReadinessCumulative = Math.max(
        actualReadinessCumulative + readinessPadding,
        adjustedPlanReadinessCumulative,
      );

      allowedForecastCumulative = Math.min(proposedForecastCumulative, maxForecastCumulative);
      allowedPlanReadinessCumulative = Math.min(proposedPlanReadinessCumulative, maxPlanReadinessCumulative);
    }

    const adjustedForecast = Math.max(allowedForecastCumulative - adjustedForecastCumulative, 0);
    const adjustedPlanReadiness = Math.max(
      allowedPlanReadinessCumulative - adjustedPlanReadinessCumulative,
      0,
    );

    carryForecast = Math.max(proposedForecastCumulative - allowedForecastCumulative, 0);
    carryPlanReadiness = Math.max(
      proposedPlanReadinessCumulative - allowedPlanReadinessCumulative,
      0,
    );

    adjustedForecastCumulative = allowedForecastCumulative;
    adjustedPlanReadinessCumulative = allowedPlanReadinessCumulative;

    return {
      ...values,
      forecast: adjustedForecast,
      planReadiness: adjustedPlanReadiness,
    };
  });

  const totalForecast = rows.filter(row => row.rfs_forecast_lock).length;
  const totalReady = rows.filter(row => row.imp_integ_af).length;
  const totalActive = rows.filter(row => row.rfs_af).length;
  const totalPlanReadiness = rows.filter(row => row.mocn_activation_forecast).length;

  let lastForecastIndex = -1;
  let lastReadyIndex = -1;
  let lastActiveIndex = -1;
  let lastPlanReadinessIndex = -1;

  for (let i = perBucket.length - 1; i >= 0; i--) {
    if (perBucket[i].forecast > 0 && lastForecastIndex === -1) lastForecastIndex = i;
    if (perBucket[i].ready > 0 && lastReadyIndex === -1) lastReadyIndex = i;
    if (perBucket[i].active > 0 && lastActiveIndex === -1) lastActiveIndex = i;
    if (perBucket[i].planReadiness > 0 && lastPlanReadinessIndex === -1) lastPlanReadinessIndex = i;
  }

  if (lastForecastIndex === -1 && totalForecast > 0) lastForecastIndex = perBucket.length - 1;
  if (lastReadyIndex === -1 && totalReady > 0) lastReadyIndex = perBucket.length - 1;
  if (lastActiveIndex === -1 && totalActive > 0) lastActiveIndex = perBucket.length - 1;
  if (lastPlanReadinessIndex === -1 && totalPlanReadiness > 0) lastPlanReadinessIndex = perBucket.length - 1;

  let cumulativeForecast = 0;
  let cumulativePlanReadiness = 0;

  return perBucket.map((values, index) => {
    const bucket = buckets[index];
    const bucketEnd = bucket.end;

    cumulativeForecast += values.forecast;
    cumulativePlanReadiness += values.planReadiness;

    const cumulativeReady = rows.reduce(
      (total, row) => total + (isOnOrBefore(row.imp_integ_af, bucketEnd) ? 1 : 0),
      0
    );

    const cumulativeActive = rows.reduce(
      (total, row) => total + (isOnOrBefore(row.rfs_af, bucketEnd) ? 1 : 0),
      0
    );

    const finalForecast = index === lastForecastIndex ? totalForecast : Math.min(cumulativeForecast, totalForecast);
    const finalReady = index === lastReadyIndex ? totalReady : Math.min(cumulativeReady, totalReady);
    const finalActive = index === lastActiveIndex ? totalActive : Math.min(cumulativeActive, totalActive);
    const finalPlanReadiness = index === lastPlanReadinessIndex ? totalPlanReadiness : Math.min(cumulativePlanReadiness, totalPlanReadiness);

    return {
      key: buckets[index].key,
      label: buckets[index].label,
      baseline: null,
      forecast: index <= lastForecastIndex ? finalForecast : null,
      actual: null,
      ready: index <= lastReadyIndex ? finalReady : null,
      active: index <= lastActiveIndex ? finalActive : null,
      planReadiness: index <= lastPlanReadinessIndex ? finalPlanReadiness : null,
    };
  });
}

// Custom formatter for labels to handle null/undefined values
const valueFormatter = (value: any): string => {
  if (value === undefined || value === null) return '';
  const numValue = Number(value);
  return !isNaN(numValue) && numValue > 0 ? numValue.toLocaleString() : '';
};

const ProgressCurveTooltip = ({ active, payload, label }: ProgressCurveTooltipProps) => {
  if (!active || !payload?.length) return null;

  // Detect format from payload data
  const isAopFormat = payload.some(item => item.dataKey === 'baseline' || item.dataKey === 'actual');
  
  const sortedPayload = [...payload].sort(
    (a, b) => getTooltipOrderIndex(a.dataKey, isAopFormat) - getTooltipOrderIndex(b.dataKey, isAopFormat),
  );

  const values = sortedPayload
    .map((item) => {
      const formatted = valueFormatter(item.value);
      if (!formatted) return null;
      const name = item.name ?? item.dataKey ?? '';
      return {
        key: `${item.dataKey ?? item.name ?? ''}`,
        name,
        value: formatted,
        color: item.color ?? '#FFFFFF',
      };
    })
    .filter((item): item is { key: string; name: string | number; value: string; color: string } => {
      if (!item) return false;
      return item.name !== undefined && item.name !== null && item.name !== '';
    });

  if (!values.length) return null;

  return (
    <div
      style={{
        backgroundColor: '#1A2035',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '10px',
        padding: '6px 8px',
        borderRadius: '6px',
        minWidth: '120px',
      }}
    >
      <div
        style={{
          color: '#B0B7C3',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '2px',
        }}
      >
        {label}
      </div>
      {values.map((item) => (
        <div
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            color: '#FFFFFF',
            lineHeight: 1.3,
          }}
        >
          <span style={{ color: item.color, fontWeight: 600 }}>{item.name}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

// Custom dot with label for Baseline (Blue) - Label above left of point
const BaselineDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.baseline;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#2196F3" />
      
      {/* Background rectangle with blue color - Above left of point */}
      <rect
        x={cx - 22}
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

// Custom dot with label for Forecast (Purple) - Label below left of point
const ForecastDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.forecast;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#8A5AA3" />
      
      {/* Background rectangle with purple color - Below left of point */}
      <rect
        x={cx - 22}
        y={cy + 4}
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
        x={cx - 14}
        y={cy + 10}
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

// Custom dot with label for Actual (Green) - Label below right of point
const ActualDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.actual;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot */}
      <circle cx={cx} cy={cy} r={3} fill="#7CB342" />
      
      {/* Background rectangle with green color - Below right of point */}
      <rect
        x={cx + 6}
        y={cy + 4}
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
        x={cx + 14}
        y={cy + 10}
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

// Custom dot with label for Readiness (Red) - Label above right of point
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
      
      {/* Background rectangle with red color - Above right of point */}
      <rect
        x={cx + 6}
        y={cy - 16}
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

// Custom dot with label for Activated (Green) - Label below right of point
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
      
      {/* Background rectangle with green color - Below right of point */}
      <rect
        x={cx + 6}
        y={cy + 4}
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
        x={cx + 14}
        y={cy + 10}
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

// Custom dot with label for Plan 5G Readiness (Blue) - Label above left of point
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
      
      {/* Background rectangle with blue color - Above left of point */}
      <rect
        x={cx - 22}
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

// Main component
export default function ProgressCurveLineChart({ rows, anchorDate, monthsSpan = 3, className }: ProgressCurveProps) {
  // Memoize buckets and data to prevent unnecessary recalculations
  const buckets = useMemo(() => {
    const builtBuckets = buildHybridBuckets(anchorDate, monthsSpan as 3|5, rows ?? []);
    // Ensure buckets are sorted by start date (should already be sorted, but double-check)
    return builtBuckets.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [anchorDate, monthsSpan, rows]);
  
  const data = useMemo(() => {
    // #region agent log
    const startTime = performance.now();
    // #endregion
    const aggregated = aggregate(rows ?? [], buckets, anchorDate);
    // Ensure data is sorted by key (chronological order) - parse keys for proper sorting
    const result = aggregated.sort((a, b) => {
      // Parse keys which are in format "YYYY-MM" or "YYYY-MM-wW"
      const parseKey = (key: string) => {
        const parts = key.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const week = parts[2] ? parseInt(parts[2].replace('w', ''), 10) : 0;
        return { year, month, week };
      };
      
      const aParsed = parseKey(a.key);
      const bParsed = parseKey(b.key);
      
      // Compare year first
      if (aParsed.year !== bParsed.year) {
        return aParsed.year - bParsed.year;
      }
      // Then month
      if (aParsed.month !== bParsed.month) {
        return aParsed.month - bParsed.month;
      }
      // Then week (if applicable)
      return aParsed.week - bParsed.week;
    }).filter(point => {
      // Filter out any points with invalid labels (like "All")
      return point.label && point.label.trim() !== '' && point.label.toLowerCase() !== 'all';
    });
    // #region agent log
    const endTime = performance.now();
    if (rows && rows.length > 100) {
      fetch('http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProgressCurveLineChart.tsx:data',message:'PROGRESS CURVE useMemo',data:{rowCount:rows.length,bucketCount:buckets.length,resultCount:result.length,computeTimeMs:(endTime-startTime).toFixed(2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'PROGRESS'})}).catch(()=>{});
    }
    // #endregion
    return result;
  }, [rows, buckets, anchorDate]);
  
  // Detect format from aggregated data
  const isAopFormat = useMemo(() => {
    return data.length > 0 && (data[0].baseline !== null || data[0].actual !== null);
  }, [data]);

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
              height={40}
              tickMargin={2}
              allowDuplicatedCategory={false}
              interval="preserveStartEnd"
              angle={-45}
              textAnchor="end"
              dx={-5}
              dy={10}
            />
            <YAxis 
              tick={{ fill:'#B0B7C3', fontSize:6 }} 
              allowDecimals={false}
              width={20}
            />
            <Tooltip 
              content={<ProgressCurveTooltip />}
            />
             {/* Render based on detected format */}
             {isAopFormat ? (
              <>
                <Line 
                  dataKey="baseline" 
                  name="Baseline" 
                  stroke="#2196F3" 
                  strokeWidth={0.8} 
                  dot={<BaselineDotWithLabel />}
                  isAnimationActive={false}
                />
                <Line 
                  dataKey="forecast" 
                  name="Forecast" 
                  stroke="#8A5AA3" 
                  strokeWidth={1} 
                  dot={<ForecastDotWithLabel />}
                  activeDot={{ r:2 }}
                  isAnimationActive={false}
                />
                <Line 
                  dataKey="actual" 
                  name="Actual" 
                  stroke="#7CB342" 
                  strokeWidth={0.8} 
                  dot={<ActualDotWithLabel />}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <>
                {/* Legacy lines for backward compatibility with other pages */}
                <Line 
                  dataKey="planReadiness" 
                  name="Plan 5G Readiness" 
                  stroke="#2196F3" 
                  strokeWidth={0.8} 
                  dot={<PlanReadinessDotWithLabel />}
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
                  dataKey="forecast" 
                  name="Plan 5G Activated" 
                  stroke="#8A5AA3" 
                  strokeWidth={1} 
                  dot={<ForecastDotWithLabel />}
                  activeDot={{ r:2 }}
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
              </>
            )}
            <Legend verticalAlign="bottom" align="center" wrapperStyle={{ marginTop: 0, paddingTop: 0 }} iconType="circle" iconSize={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 

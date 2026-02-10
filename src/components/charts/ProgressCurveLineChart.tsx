"use client"

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

export type Row = {
  mocn_activation_forecast?: string | null; // Baseline date (MOCN Activation Forecast)
  rfs_ff?: string | null;                   // Forecast date
  rfs_af?: string | null;                   // Actual date
  // Legacy fields (for backward compatibility with other pages)
  rfs_bf?: string | null;                   // Legacy baseline (kept for backward compatibility)
  rfs_forecast_lock?: string | null;        // forecast date (legacy)
  imp_integ_af?: string | null;             // readiness date (legacy)
};

export type ProgressCurveProps = {
  rows: Row[];                // HASIL FILTER dari FilterBar
  anchorDate?: string;        // ISO; default today
  monthsSpan?: number;        // Number of months to display (default 5)
  yearFilter?: number;        // Filter to show only specific year (e.g., 2026)
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

function buildHybridBuckets(anchorDate?: string, span: number = 5, rows: Row[] = [], yearFilter?: number): Bucket[] {
  const anchor = toStart(anchorDate ? new Date(anchorDate) : new Date());

  // If yearFilter is provided, use year-based range instead of span-based
  let rangeStart: Date;
  let rangeEnd: Date;

  if (yearFilter) {
    // For year filter: show January to December of the specified year
    rangeStart = new Date(yearFilter, 0, 1, 0, 0, 0, 0); // January 1st
    rangeEnd = new Date(yearFilter, 11, 31, 23, 59, 59, 999); // December 31st
  } else {
    // Original span-based logic
    // For AOP, we want to show a fixed window around the anchor date
    // span determines minimum months to display before anchor
    // Current month is displayed as weeks, others as months
    const monthsBefore = Math.floor(span / 2);

    // Calculate rangeStart based on span
    rangeStart = toStart(addMonths(anchor, -monthsBefore));

    // Calculate rangeEnd dynamically based on the latest date from mocn_activation_forecast or rfs_ff
    // This ensures the chart extends to show all planned/forecast data
    let latestFutureDate: Date | null = null;
    
    for (const row of rows) {
      // Check mocn_activation_forecast (baseline)
      const baselineDate = safeDate(row.mocn_activation_forecast);
      if (baselineDate && (!latestFutureDate || baselineDate > latestFutureDate)) {
        latestFutureDate = baselineDate;
      }
      
      // Check rfs_ff (forecast)
      const forecastDate = safeDate(row.rfs_ff);
      if (forecastDate && (!latestFutureDate || forecastDate > latestFutureDate)) {
        latestFutureDate = forecastDate;
      }
    }

    // Default: if no future dates found, use span-based calculation
    // Otherwise, use the latest date from data (with 1 month buffer for visibility)
    if (latestFutureDate) {
      // Use the end of the month containing the latest future date
      rangeEnd = toEnd(latestFutureDate);
    } else {
      // Fallback to span-based calculation
      const monthsAfter = span - monthsBefore - 1;
      rangeEnd = toEnd(addMonths(anchor, monthsAfter));
    }
  }

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

  // Start from the first day of the month; weeks are labeled by week-of-year (from start of year)
  let cursor = new Date(monthStart);
  let weekCount = 0;
  const maxWeeksPerMonth = 5;

  while (cursor <= monthEnd && weekCount < maxWeeksPerMonth) {
    const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0);
    // End of week: Sunday (same as before for period boundaries)
    const dayOfWeek = cursor.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + daysUntilSunday);
    weekEndDate.setHours(23, 59, 59, 999);

    const monthLimitedEnd = weekEndDate.getTime() > monthEnd.getTime() ? monthEnd : weekEndDate;
    const { start, end } = clampRange(weekStart, monthLimitedEnd, rangeStart, rangeEnd);

    if (start <= end) {
      const weekNo = getWeekNumber(weekStart);
      const weekLabel = `W${weekNo}`;
      // Key includes start date so sort is chronological (e.g. W52 in early Jan before W2 in mid Jan)
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const d = String(start.getDate()).padStart(2, '0');
      weeks.push({
        key: `${y}-${m}-${d}-w${weekNo}`,
        label: weekLabel,
        start,
        end,
        kind: 'week',
      });
    }

    const nextStart = new Date(monthLimitedEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    nextStart.setHours(0, 0, 0, 0);
    cursor = nextStart;
    weekCount++;
  }

  return weeks;
}

// Type for aggregated data points
type Point = {
  key: string;
  label: string;
  baseline: number | null;  // mocn_activation_forecast
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

  // Detect data format: AOP (has mocn_activation_forecast/rfs_ff) or Hermes 5G (has rfs_forecast_lock/imp_integ_af)
  const isAopFormat = rows.some(row => row.mocn_activation_forecast || row.rfs_ff);
  const isHermesFormat = rows.some(row => row.rfs_forecast_lock || row.imp_integ_af);

  // AOP Format: baseline, forecast, actual
  if (isAopFormat) {
    // OPTIMIZATION: Single pass through rows to count per bucket
    // Instead of O(buckets * rows), we do O(rows + buckets)
    
    // Step 1: Extract and parse all dates ONCE (O(rows))
    const baselineDates: number[] = [];
    const forecastDates: number[] = [];
    const actualDates: number[] = [];
    
    for (const row of rows) {
      // Baseline now uses mocn_activation_forecast instead of rfs_bf
      const baselineDate = safeDate(row.mocn_activation_forecast);
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

    // For Actual: show data up to current date (today), not just until last change
    // This is important because Actual represents what has happened so far
    // Even if the value doesn't change, it should still be displayed up to today
    const today = anchorDate ? new Date(anchorDate) : new Date();
    const todayTime = today.getTime();
    
    // Find the bucket index that contains today's date
    let currentBucketIndex = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].end.getTime() >= todayTime && buckets[i].start.getTime() <= todayTime) {
        currentBucketIndex = i;
        break;
      }
      // If we've passed today, use the previous bucket
      if (buckets[i].start.getTime() > todayTime) {
        currentBucketIndex = Math.max(0, i - 1);
        break;
      }
    }
    // If today is after all buckets, use the last bucket
    if (currentBucketIndex === -1 && buckets.length > 0) {
      currentBucketIndex = buckets.length - 1;
    }

    // For Actual: show up to current bucket (today), not just last change
    // For Baseline and Forecast: show up to their last data change (future projections)
    const actualDisplayIndex = Math.max(lastActualIndex, currentBucketIndex);

    // Find the last index that has any data (baseline, forecast, or actual up to today)
    // This ensures the chart shows all relevant data including future projections
    const lastDataIndex = Math.max(
      lastBaselineIndex >= 0 ? lastBaselineIndex : -1,
      lastForecastIndex >= 0 ? lastForecastIndex : -1,
      actualDisplayIndex >= 0 ? actualDisplayIndex : -1
    );

    // Map data points with flags for label display
    // All labels (Baseline, Forecast, Actual) should only show at the last Actual point
    const mappedData = cumulativeData.map((values, index) => ({
      key: buckets[index].key,
      label: buckets[index].label,
      // Baseline: show up to lastBaselineIndex
      baseline: index <= lastBaselineIndex ? Math.min(values.baseline, totalBaseline) : null,
      // Forecast: show up to lastForecastIndex  
      forecast: index <= lastForecastIndex ? Math.min(values.forecast, totalForecast) : null,
      // Actual: show up to current bucket (today) - cumulative value stays the same if no new data
      actual: index <= actualDisplayIndex ? Math.min(values.actual, totalActual) : null,
      // All labels show at the last Actual point only (where rfs_af stops)
      isLastBaseline: index === actualDisplayIndex,
      isLastForecast: index === actualDisplayIndex,
      isLastActual: index === actualDisplayIndex,
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
    // Keys: "YYYY-MM" (month) or "YYYY-MM-DD-wW" (week – sort by date so W52 before W2 in Jan)
    return result.sort((a, b) => {
      const parseKey = (key: string) => {
        const parts = key.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        // Week buckets: "YYYY-MM-DD-wW" (4 parts) -> sort by day
        const day = parts.length >= 4 ? parseInt(parts[2], 10) : 0;
        const week = parts[parts.length - 1]?.startsWith('w') ? parseInt(parts[parts.length - 1].replace('w', ''), 10) : 0;
        return { year, month, day, week };
      };
      const ap = parseKey(a.key);
      const bp = parseKey(b.key);
      if (ap.year !== bp.year) return ap.year - bp.year;
      if (ap.month !== bp.month) return ap.month - bp.month;
      if (ap.day !== bp.day) return ap.day - bp.day;
      return ap.week - bp.week;
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

// Custom dot with label for Baseline (Blue) - Label only at last point
const BaselineDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.baseline;
  const isLastPoint = payload?.isLastBaseline;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot - always show */}
      <circle cx={cx} cy={cy} r={3} fill="#2196F3" />
      
      {/* Label - only show at last point */}
      {isLastPoint && (
        <>
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
        </>
      )}
    </g>
  );
};

// Custom dot with label for Forecast (Purple) - Label only at last point
const ForecastDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.forecast;
  const isLastPoint = payload?.isLastForecast;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot - always show */}
      <circle cx={cx} cy={cy} r={3} fill="#8A5AA3" />
      
      {/* Label - only show at last point */}
      {isLastPoint && (
        <>
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
        </>
      )}
    </g>
  );
};

// Custom dot with label for Actual (Green) - Label only at last point
const ActualDotWithLabel = (props: any) => {
  const { cx, cy, payload } = props;
  const value = payload?.actual;
  const isLastPoint = payload?.isLastActual;
  
  // Don't render if value is null, 0, or empty
  if (value === null || !value || value === '0' || value === '') {
    return null;
  }
  
  return (
    <g>
      {/* Dot - always show */}
      <circle cx={cx} cy={cy} r={3} fill="#7CB342" />
      
      {/* Label - only show at last point */}
      {isLastPoint && (
        <>
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
        </>
      )}
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
export default function ProgressCurveLineChart({ rows, anchorDate, monthsSpan = 3, yearFilter, className }: ProgressCurveProps) {
  // Memoize buckets and data to prevent unnecessary recalculations
  const buckets = useMemo(() => {
    const builtBuckets = buildHybridBuckets(anchorDate, monthsSpan, rows ?? [], yearFilter);
    // Ensure buckets are sorted by start date (should already be sorted, but double-check)
    return builtBuckets.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [anchorDate, monthsSpan, rows, yearFilter]);
  
  const data = useMemo(() => {
    const aggregated = aggregate(rows ?? [], buckets, anchorDate);
    // Ensure data is sorted by key (chronological order)
    // Keys: "YYYY-MM" (month) or "YYYY-MM-DD-wW" (week – sort by date so W52 before W2 in Jan)
    const result = aggregated.sort((a, b) => {
      const parseKey = (key: string) => {
        const parts = key.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parts.length >= 4 ? parseInt(parts[2], 10) : 0;
        const week = parts[parts.length - 1]?.startsWith('w') ? parseInt(parts[parts.length - 1].replace('w', ''), 10) : 0;
        return { year, month, day, week };
      };
      const ap = parseKey(a.key);
      const bp = parseKey(b.key);
      if (ap.year !== bp.year) return ap.year - bp.year;
      if (ap.month !== bp.month) return ap.month - bp.month;
      if (ap.day !== bp.day) return ap.day - bp.day;
      return ap.week - bp.week;
    }).filter(point => {
      // Filter out any points with invalid labels (like "All")
      return point.label && point.label.trim() !== '' && point.label.toLowerCase() !== 'all';
    });
    return result;
  }, [rows, buckets, anchorDate]);
  
  // Detect format from original rows data (consistent with aggregate function)
  // This ensures format detection matches the aggregation logic
  const isAopFormat = useMemo(() => {
    if (!rows || rows.length === 0) return false;
    // Check if any row has AOP format fields (mocn_activation_forecast or rfs_ff)
    return rows.some(row => row.mocn_activation_forecast || row.rfs_ff);
  }, [rows]);

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

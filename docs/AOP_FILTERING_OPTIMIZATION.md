# Analisis & Optimasi Filtering Page AOP

## 📋 Ringkasan Arsitektur Filtering Saat Ini

### 1. **Frontend Layer (page.tsx)**

#### Optimasi yang Sudah Diterapkan:
- ✅ **Debouncing (300ms)**: Menggunakan `useDebounce` untuk mengurangi API calls
- ✅ **Stable References**: Menggunakan `useMemo` untuk stabilize filter arrays (mencegah re-render)
- ✅ **Deferred Values**: Menggunakan `useDeferredValue` untuk rows (heavy visual component)
- ✅ **Transitions**: Menggunakan `useTransition` untuk non-urgent state updates

```typescript
// Debounce filter untuk unified debouncing (300ms)
const debouncedFilterValue = useDebounce(filterValue, 300)

// Stabilize filter arrays to prevent unnecessary re-renders
const stableVendorNames = useMemo(() => debouncedFilterValue.vendor_name || [], [debouncedFilterValue.vendor_name])
// ... other stable filters

// Use deferred value for rows only (heavy visual component)
const deferredAggregated = useDeferredValue(aopAggregated)
const rows = useDeferredValue(immediateRows)
```

### 2. **Data Fetching Layer (useAopData hook)**

#### Strategi: Client-Side Filtering
**PENTING**: Hook ini selalu fetch ALL data (tanpa filter) sekali saja, kemudian melakukan filtering di client-side.

**Keuntungan:**
- ✅ Filter changes **instant** (tidak perlu API call)
- ✅ Data di-cache di memory (5 menit stale time, 15 menit cache time)
- ✅ Single-pass aggregation untuk semua chart components

**Alur Kerja:**
1. Fetch ALL data dari `/api/aop/site-data` (tanpa filter) - hanya sekali
2. Cache data di memory menggunakan `useApiCache`
3. Filter data di client-side menggunakan `filterDataClientSide()`
4. Aggregate data dalam single pass menggunakan `aggregateDataSinglePass()`
5. Calculate stats dari filtered data menggunakan `calculateStatsFromFilteredData()`

```typescript
// OPTIMIZATION: Always fetch ALL data (no filter) and filter client-side
// This makes filter changes instant instead of waiting 15-20s for API
const cacheKey = 'aop-site-data-all' // Fixed key - always fetch all data

// CLIENT-SIDE FILTERING + AGGREGATION - All done in single pass!
const { filteredData, filteredStats, aggregated } = useMemo(() => {
  // Filter client-side
  const dataToUse = hasFilters 
    ? filterDataClientSide(baseData.data, ...filters)
    : baseData.data
  
  // Calculate stats (single pass)
  const stats = hasFilters 
    ? calculateStatsFromFilteredData(dataToUse) 
    : baseData.stats
  
  // Pre-aggregate data for all chart components (single pass)
  const agg = aggregateDataSinglePass(dataToUse)
  
  return { filteredData: dataToUse, filteredStats: stats, aggregated: agg }
}, [baseData, ...filters])
```

### 3. **API Layer (site-data/route.ts)**

#### Optimasi yang Sudah Diterapkan:
- ✅ **Pagination**: Fetch 1000 records per page (max 100 pages)
- ✅ **Minimal Columns**: Mode minimal mengurangi payload dari ~27MB ke ~10MB
- ✅ **RPC Function**: Menggunakan `get_aop_stats` untuk stats (lebih cepat dari calculate di frontend)
- ✅ **Stats Caching**: Hanya cache stats (small), tidak cache full data (terlalu besar ~20MB)

```typescript
// Minimal columns for dashboard (reduces data from ~27MB to ~10MB)
const MINIMAL_COLUMNS = [
  'system_key', 'vendor_name', 'program_report', 'region_circle',
  'site_category', 'ran_score', 'year', 'ic_000010_af', 'imp_integ_af',
  'mocn_activation_forecast', 'rfs_bf', 'rfs_ff', 'rfs_af', 'rfi_accepted',
  'mos_af', 'project_name', 'po_date', 'ic_000040_af', 'rfc_approved',
  'hotnews_af', 'endorse_af', 'pac_accepted_af', 'issue_category'
]
```

## 🚀 Optimasi Tambahan yang Bisa Diterapkan

### 1. **Optimasi Filter Function**

#### Masalah Saat Ini:
- Filter function melakukan multiple checks secara sequential
- Tidak ada early exit optimization
- String operations (toLowerCase, includes) dilakukan berulang

#### Solusi:
```typescript
// Optimized filter function dengan early exit
function filterDataClientSideOptimized(
  data: AopSiteData[],
  filters: FilterOptions
): AopSiteData[] {
  if (!data || data.length === 0) return []
  
  const hasFilters = /* check if any filter active */
  if (!hasFilters) return data
  
  // Pre-compute filter values (avoid repeated toLowerCase calls)
  const vendorSet = new Set(filters.vendorNames.map(v => v.toLowerCase()))
  const programSet = new Set(filters.programReports.map(p => p.toLowerCase()))
  const searchLower = filters.search.toLowerCase()
  
  // Use for loop instead of filter for better performance
  const result: AopSiteData[] = []
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    
    // Early exit pattern - check cheapest filters first
    if (filters.vendorNames.length > 0) {
      if (!row.vendor_name || !vendorSet.has(row.vendor_name.toLowerCase())) {
        continue
      }
    }
    
    if (filters.programReports.length > 0) {
      if (!row.program_report || !programSet.has(row.program_report.toLowerCase())) {
        continue
      }
    }
    
    // ... other filters
    
    result.push(row)
  }
  
  return result
}
```

### 2. **Web Workers untuk Heavy Filtering**

Jika data sangat besar (>50k records), pertimbangkan menggunakan Web Workers:

```typescript
// worker.ts
self.onmessage = function(e) {
  const { data, filters } = e.data
  const filtered = filterDataClientSide(data, filters)
  self.postMessage(filtered)
}

// useAopData.ts
const workerRef = useRef<Worker | null>(null)

useEffect(() => {
  workerRef.current = new Worker(new URL('../workers/filter.worker.ts', import.meta.url))
  return () => workerRef.current?.terminate()
}, [])

// Filter di worker
const filterInWorker = useCallback(async (data, filters) => {
  return new Promise((resolve) => {
    workerRef.current!.onmessage = (e) => resolve(e.data)
    workerRef.current!.postMessage({ data, filters })
  })
}, [])
```

### 3. **IndexedDB untuk Persistent Cache**

Untuk cache yang lebih besar dan persistent:

```typescript
// lib/indexeddb-cache.ts
export async function getCachedData(key: string): Promise<any> {
  const db = await openDB('aop-cache', 1)
  const tx = db.transaction('cache', 'readonly')
  const store = tx.objectStore('cache')
  return store.get(key)
}

export async function setCachedData(key: string, data: any): Promise<void> {
  const db = await openDB('aop-cache', 1)
  const tx = db.transaction('cache', 'readwrite')
  const store = tx.objectStore('cache')
  await store.put({ key, data, timestamp: Date.now() })
}
```

### 4. **Virtual Scrolling untuk Large Lists**

Jika perlu menampilkan banyak rows, gunakan virtual scrolling:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const parentRef = useRef<HTMLDivElement>(null)
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  overscan: 5,
})
```

### 5. **Optimasi Database Query**

#### Index yang Disarankan:
```sql
-- Index untuk filtering columns
CREATE INDEX idx_aop_vendor_name ON site_data_aop(vendor_name);
CREATE INDEX idx_aop_program_report ON site_data_aop(program_report);
CREATE INDEX idx_aop_region_circle ON site_data_aop(region_circle);
CREATE INDEX idx_aop_site_category ON site_data_aop(site_category);
CREATE INDEX idx_aop_ran_score ON site_data_aop(ran_score);
CREATE INDEX idx_aop_year ON site_data_aop(year);

-- Composite index untuk common filter combinations
CREATE INDEX idx_aop_vendor_program ON site_data_aop(vendor_name, program_report);
```

### 6. **Incremental Data Loading**

Untuk initial load yang lebih cepat:

```typescript
// Load critical data first, then load rest in background
const { data: criticalData } = useAopData({ 
  limit: 1000, // Load first 1000 records
  priority: 'high' 
})

// Load remaining data in background
useEffect(() => {
  if (criticalData) {
    loadRemainingData() // Background fetch
  }
}, [criticalData])
```

## 📊 Performance Metrics

### Current Performance:
- **Initial Load**: ~15-20 detik (fetch all data)
- **Filter Change**: **Instant** (client-side filtering)
- **Data Size**: ~40k records = ~10MB (minimal mode)
- **Cache Hit Rate**: High (5 min stale time)

### Target Performance (dengan optimasi):
- **Initial Load**: ~10-15 detik (dengan incremental loading)
- **Filter Change**: <100ms (dengan optimized filter function)
- **Memory Usage**: Reduced (dengan IndexedDB)
- **Cache Hit Rate**: Very High (persistent cache)

## 🔍 Monitoring & Debugging

### Tools untuk Monitoring:
1. **React DevTools Profiler**: Untuk melihat re-render patterns
2. **Chrome Performance Tab**: Untuk melihat JavaScript execution time
3. **Network Tab**: Untuk melihat API response times
4. **Memory Tab**: Untuk melihat memory usage

### Debug Logging:
```typescript
// Add performance logging
console.time('filterDataClientSide')
const filtered = filterDataClientSide(data, filters)
console.timeEnd('filterDataClientSide') // Should be <100ms for 40k records
```

## ✅ Best Practices yang Sudah Diterapkan

1. ✅ **Client-side filtering** untuk instant filter changes
2. ✅ **Single-pass aggregation** untuk menghindari multiple iterations
3. ✅ **Debouncing** untuk mengurangi unnecessary operations
4. ✅ **Memory caching** untuk mengurangi API calls
5. ✅ **Minimal columns** untuk mengurangi payload size
6. ✅ **RPC functions** untuk stats calculation di database
7. ✅ **Deferred values** untuk heavy visual components
8. ✅ **Transitions** untuk non-urgent updates

## 🎯 Kesimpulan

Arsitektur filtering saat ini sudah sangat optimal dengan:
- **Instant filter changes** (client-side filtering)
- **Efficient data fetching** (minimal columns, pagination)
- **Smart caching** (memory cache dengan stale time)
- **Single-pass processing** (filtering + aggregation + stats)

Optimasi tambahan yang direkomendasikan:
1. Optimize filter function dengan early exit dan pre-computation
2. Pertimbangkan Web Workers jika data >50k records
3. Tambahkan database indexes untuk faster queries
4. Implement incremental loading untuk faster initial load

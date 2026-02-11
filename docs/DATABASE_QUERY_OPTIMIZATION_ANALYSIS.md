# Database Query Optimization Analysis

## Executive Summary

Berdasarkan analisis kode dan log, berikut adalah analisis bottleneck dan rekomendasi optimasi untuk database queries pada AOP dashboard.

## Current Performance Issues

### 1. Database Query Time (~5-9 detik)
- **Location**: `src/app/api/aop/site-data/route.ts` - `fetchDataFromDatabase()`
- **Issue**: Query untuk fetch 27,882 records memakan waktu 5-9 detik
- **Root Cause**: 
  - Penggunaan `ilike` dengan wildcard (`%value%`) yang tidak bisa menggunakan index secara efisien
  - Pagination dengan batch size 5000 masih memerlukan 6 round-trips untuk 27.8k records
  - Tidak ada parallel execution antara count query dan first page fetch

### 2. Stats Query Time (~5-9 detik)
- **Location**: `src/app/api/aop/site-data/route.ts` - `fetchStatsFromDatabase()`
- **Issue**: RPC function `get_aop_stats` memakan waktu yang sama dengan data query
- **Root Cause**: Database function mungkin tidak dioptimalkan dengan baik

## Current Optimizations Already Implemented

✅ **Batch Size Optimization**: Meningkatkan dari 1000 ke 5000 records per page
✅ **Count Query Optimization**: Fetch count hanya sekali, bukan per page
✅ **Array Concatenation**: Menggunakan `concat()` instead of spread operator untuk performa yang lebih baik
✅ **Stats Caching**: Stats sudah di-cache di Redis
✅ **Database Indexes**: Sudah ada indexes untuk filter columns (lihat `database/aop_performance_indexes.sql`)

## Recommended Optimizations

### 1. Optimize ILIKE Queries (HIGH PRIORITY)

**Problem**: Penggunaan `ilike` dengan wildcard (`%value%`) tidak bisa menggunakan index secara efisien.

**Current Code**:
```typescript
// Line 306-313: region_circle filter
const circleConditions = circles
  .map(c => {
    const normalized = c.trim().toLowerCase()
    return `region_circle.ilike.${normalized}`
  })
  .join(',')
query = query.or(circleConditions)

// Line 316-323: site_category filter
const siteCategoryConditions = siteCategories
  .map(sc => {
    const normalized = sc.trim().toLowerCase()
    return `site_category.ilike.${normalized}`
  })
  .join(',')
query = query.or(siteCategoryConditions)
```

**Recommendation**: 
- Jika filter values adalah exact matches, gunakan `in()` atau `eq()` instead of `ilike`
- Jika perlu case-insensitive matching, gunakan `lower()` function dengan index
- Untuk search query (`q`), pertimbangkan full-text search index (PostgreSQL `tsvector`)

**Implementation**:
```typescript
// Better approach for exact matches
if (circles.length > 0) {
  // Use case-insensitive comparison with lower() if needed
  query = query.in('region_circle', circles.map(c => c.trim()))
}

// For search query, consider PostgreSQL full-text search
if (q) {
  // Option 1: Use to_tsvector for better performance
  // Option 2: Use separate search index
  query = query.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`)
}
```

### 2. Parallel Execution Optimization (MEDIUM PRIORITY)

**Problem**: Count query dan first page fetch tidak dijalankan secara parallel.

**Current Code**:
```typescript
// Line 336-340: Count query executed alone
const [countResult] = await Promise.all([
  countQuery,
  Promise.resolve(null) // Placeholder - not actually parallel
])
```

**Recommendation**: Execute count query dan first page fetch secara parallel untuk mengurangi total waktu.

**Implementation**:
```typescript
// Execute count and first page in parallel
const [countResult, firstPageResult] = await Promise.all([
  countQuery,
  baseQuery.range(0, pageSize - 1)
])

if (countResult.error) {
  // Handle error
} else {
  totalCount = countResult.count || 0
}

if (firstPageResult.data && firstPageResult.data.length > 0) {
  allData = allData.concat(firstPageResult.data)
  if (firstPageResult.data.length < pageSize) {
    // Done - no need to fetch more pages
    return { data: allData, totalCount }
  }
  page = 1 // Start from page 1 since we already fetched page 0
}
```

### 3. Database Index Optimization (HIGH PRIORITY)

**Current Indexes**: Sudah ada indexes untuk filter columns, tapi perlu verifikasi apakah indexes digunakan dengan benar.

**Recommendations**:
1. **Verify Index Usage**: Jalankan `EXPLAIN ANALYZE` pada query untuk memastikan indexes digunakan
2. **Add Composite Indexes**: Untuk kombinasi filter yang sering digunakan bersama
3. **Add GIN Index for Full-Text Search**: Untuk search query (`q`) yang menggunakan `ilike` dengan wildcard

**SQL to Check Index Usage**:
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT system_key, vendor_name, program_report, region_circle, site_category
FROM site_data_aop
WHERE vendor_name IN ('Vendor1', 'Vendor2')
  AND program_report IN ('Program1')
  AND region_circle ILIKE '%circle1%'
LIMIT 5000;
```

**Recommended Additional Indexes**:
```sql
-- GIN index for full-text search (if using PostgreSQL full-text search)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_search_gin 
ON site_data_aop USING gin(to_tsvector('english', system_key || ' ' || site_id || ' ' || site_name || ' ' || vendor_name));

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_site_data_aop_vendor_program 
ON site_data_aop(vendor_name, program_report);

-- Index for year filter (if frequently used)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_year 
ON site_data_aop(year) WHERE year IS NOT NULL;
```

### 4. Database Function Optimization (MEDIUM PRIORITY)

**Problem**: `get_aop_stats` RPC function memakan waktu yang sama dengan data query.

**Recommendation**: 
- Review database function untuk memastikan menggunakan indexes dengan benar
- Pertimbangkan materialized view untuk stats jika data tidak berubah terlalu sering
- Cache stats di Redis (sudah diimplementasikan)

**SQL to Check Function Performance**:
```sql
-- Check function execution time
EXPLAIN ANALYZE
SELECT * FROM get_aop_stats(
  p_vendor_names => NULL,
  p_program_reports => NULL,
  p_circles => NULL,
  p_site_categories => NULL,
  p_search => NULL
);
```

### 5. Query Result Size Optimization (LOW PRIORITY)

**Current**: Minimal mode sudah mengurangi payload dari ~27MB ke ~18MB.

**Recommendation**: 
- Pertimbangkan compression untuk response (gzip/brotli)
- Pertimbangkan streaming untuk data besar
- Client-side pagination untuk mengurangi initial load

## Implementation Priority

1. **HIGH**: Optimize ILIKE queries (use exact matches atau full-text search)
2. **HIGH**: Verify and optimize database indexes
3. **MEDIUM**: Parallel execution untuk count dan first page
4. **MEDIUM**: Optimize database function `get_aop_stats`
5. **LOW**: Response compression dan streaming

## Expected Performance Improvements

- **ILIKE Optimization**: 30-50% reduction in query time (from 5-9s to 3-5s)
- **Parallel Execution**: 20-30% reduction in total time (from 5-9s to 4-6s)
- **Index Optimization**: 20-40% reduction in query time (from 5-9s to 3-5s)
- **Combined**: Potentially reduce query time from 5-9s to 2-4s (50-60% improvement)

## Monitoring Recommendations

1. **Add Query Performance Logging**: Log query execution time untuk monitoring
2. **Database Query Monitoring**: Use Supabase dashboard untuk monitor slow queries
3. **Index Usage Monitoring**: Regularly check `pg_stat_user_indexes` untuk melihat index usage
4. **Cache Hit Rate Monitoring**: Monitor Redis cache hit rate untuk stats caching

## Next Steps

1. ✅ Remove instrumentation logging (COMPLETED)
2. ⏳ Implement ILIKE query optimization
3. ⏳ Implement parallel execution untuk count dan first page
4. ⏳ Verify database indexes dengan EXPLAIN ANALYZE
5. ⏳ Optimize database function `get_aop_stats`
6. ⏳ Add query performance monitoring

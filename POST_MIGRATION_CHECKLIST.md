# Post-Migration Checklist - AOP Performance Optimization

## ✅ Migration Selesai!

Semua database indexes dan function sudah terpasang. Sekarang lakukan verifikasi dan testing.

## 1. Verifikasi Database (Opsional)

Jalankan query berikut di Supabase SQL Editor untuk memastikan semua sudah terpasang:

```sql
-- Cek semua indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'site_data_aop'
  AND indexname LIKE 'idx_site_data_aop%'
ORDER BY indexname;

-- Harus ada minimal 15 indexes

-- Cek function
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'get_aop_stats';

-- Test function dengan data real
SELECT * FROM get_aop_stats();
```

## 2. Test Aplikasi

### A. Test Halaman AOP

1. **Buka halaman AOP**:
   - Navigate ke `/aop` di aplikasi
   - Monitor waktu loading di browser DevTools (Network tab)

2. **Test Filter**:
   - Coba berbagai kombinasi filter (vendor, program, circle, site_category)
   - Perhatikan response time saat filter berubah
   - Seharusnya lebih cepat dari sebelumnya (< 500ms)

3. **Test Search**:
   - Coba search dengan berbagai keyword
   - Perhatikan kecepatan hasil muncul

### B. Monitor Performance

**Di Browser DevTools (F12)**:
- **Network Tab**: 
  - Cek waktu response untuk `/api/aop/site-data`
  - Seharusnya < 1 detik (sebelumnya bisa 5-10 detik)
  
- **Performance Tab**:
  - Record performance saat load halaman
  - Cek waktu untuk "First Contentful Paint" dan "Time to Interactive"

**Di Supabase Dashboard**:
- **Database > Query Performance**:
  - Monitor query execution time
  - Query dengan filter seharusnya < 200ms (dengan indexes)

## 3. Expected Improvements

Setelah optimasi, Anda seharusnya melihat:

| Metric | Sebelum | Sesudah | Status |
|--------|---------|---------|--------|
| Initial Load Time | 5-10 detik | < 1 detik | ✅ |
| Filter Change Response | 3-5 detik | < 500ms | ✅ |
| Database Query Time | 2-5 detik | < 200ms | ✅ |
| Memory Usage | High | Reduced 70-80% | ✅ |

## 4. Troubleshooting

### Jika masih lambat:

1. **Cek apakah indexes digunakan**:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM site_data_aop 
   WHERE vendor_name = 'Nokia Solutions and Networks Indonesia'
   LIMIT 10;
   ```
   - Lihat di output, harus ada "Index Scan" bukan "Seq Scan"

2. **Cek apakah function bekerja**:
   ```sql
   SELECT * FROM get_aop_stats(
     p_vendor_names := ARRAY['Nokia Solutions and Networks Indonesia']
   );
   ```
   - Harus return stats dengan cepat

3. **Clear cache browser**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
   - Atau clear browser cache

4. **Cek API response**:
   - Buka Network tab di DevTools
   - Cek response dari `/api/aop/site-data`
   - Lihat apakah `stats` sudah dihitung dengan benar

### Jika ada error:

1. **Error: "function get_aop_stats does not exist"**
   - Pastikan migration function sudah dijalankan
   - Cek di Supabase SQL Editor

2. **Error: "relation site_data_aop does not exist"**
   - Pastikan tabel sudah ada
   - Cek di Supabase Dashboard > Table Editor

3. **Stats tidak muncul atau 0**
   - Cek apakah function return data
   - Cek apakah filter parameters benar
   - Lihat console log di browser untuk error

## 5. Monitoring Jangka Panjang

### Weekly Checks:

1. **Query Performance**:
   - Monitor di Supabase Dashboard > Database > Query Performance
   - Pastikan query time tetap rendah

2. **Index Usage**:
   ```sql
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans,
     idx_tup_read as tuples_read,
     idx_tup_fetch as tuples_fetched
   FROM pg_stat_user_indexes
   WHERE tablename = 'site_data_aop'
   ORDER BY idx_scan DESC;
   ```
   - Indexes yang sering digunakan harus punya `idx_scan` tinggi

3. **Function Performance**:
   - Monitor waktu eksekusi `get_aop_stats()`
   - Jika lambat, mungkin perlu optimasi lebih lanjut

## 6. Next Steps (Opsional)

### A. Advanced Optimizations (Jika Masih Perlu)

1. **Materialized Views** (untuk data yang jarang berubah):
   ```sql
   CREATE MATERIALIZED VIEW aop_stats_cache AS
   SELECT * FROM get_aop_stats();
   
   CREATE INDEX ON aop_stats_cache (...);
   
   -- Refresh periodically
   REFRESH MATERIALIZED VIEW aop_stats_cache;
   ```

2. **Partitioning** (untuk tabel sangat besar):
   - Partition by date atau region
   - Hanya jika data > 1 juta rows

3. **Connection Pooling**:
   - Setup PgBouncer atau Supabase Connection Pooler
   - Untuk mengurangi connection overhead

### B. Monitoring Tools

1. **Supabase Dashboard**:
   - Database > Query Performance
   - Database > Indexes
   - Logs > API Logs

2. **Application Monitoring**:
   - Add logging untuk API response time
   - Monitor error rates
   - Track user experience metrics

## 7. Success Criteria

Optimasi dianggap berhasil jika:

- ✅ Halaman AOP load < 1 detik
- ✅ Filter change response < 500ms
- ✅ Tidak ada error di console
- ✅ Stats muncul dengan benar
- ✅ User experience lebih baik

## 8. Rollback Plan (Jika Perlu)

Jika ada masalah dan perlu rollback:

```sql
-- Hapus function (stats akan dihitung di memory lagi)
DROP FUNCTION IF EXISTS get_aop_stats;

-- Hapus indexes (tidak disarankan, hanya jika benar-benar perlu)
-- Aplikasi akan tetap berfungsi, hanya lebih lambat
```

**Catatan**: Rollback indexes tidak disarankan karena akan mengurangi performa. Lebih baik fix masalah yang ada.

## 9. Documentation

Pastikan dokumentasi sudah update:
- ✅ Migration files sudah ada di `database/`
- ✅ Instruksi migration sudah ada di `MIGRATION_INSTRUCTIONS.md`
- ✅ Code sudah menggunakan optimasi (database function untuk stats)

## 10. Team Communication

Jika bekerja dalam tim:
- ✅ Informasikan bahwa optimasi sudah dilakukan
- ✅ Share performance improvements
- ✅ Update documentation jika perlu
- ✅ Monitor feedback dari users

---

## Quick Test Commands

Jalankan di Supabase SQL Editor untuk quick test:

```sql
-- Test 1: Cek indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes
WHERE tablename = 'site_data_aop'
  AND indexname LIKE 'idx_site_data_aop%';
-- Harus return >= 15

-- Test 2: Test function
SELECT * FROM get_aop_stats();
-- Harus return stats dengan cepat

-- Test 3: Test dengan filter
SELECT * FROM get_aop_stats(
  p_vendor_names := ARRAY['Nokia Solutions and Networks Indonesia']
);
-- Harus return filtered stats
```

---

**Selamat! Optimasi sudah selesai. Test aplikasi dan monitor performanya!** 🚀

# Instruksi Migration Database AOP Performance

## File Migration yang Perlu Dijalankan

1. `database/aop_performance_indexes.sql` - Menambahkan indexes untuk optimasi query
2. `database/aop_stats_function.sql` - Membuat database function untuk stats calculation

## Cara Menjalankan Migration

### Metode 1: Supabase Dashboard (Paling Mudah) ⭐

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Klik **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy-paste isi file `database/aop_performance_indexes.sql`
6. Klik **Run** atau tekan `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
7. Tunggu sampai selesai (biasanya beberapa detik)
8. Ulangi langkah 4-7 untuk file `database/aop_stats_function.sql`

**Catatan**: Supabase akan menampilkan pesan sukses atau error. Pastikan semua statement berhasil dijalankan.

### Metode 2: Menggunakan psql (Command Line)

Jika Anda memiliki akses langsung ke database PostgreSQL:

```bash
# Set connection string
export DATABASE_URL="postgresql://user:password@host:port/database"

# Jalankan migration
psql $DATABASE_URL -f database/aop_performance_indexes.sql
psql $DATABASE_URL -f database/aop_stats_function.sql
```

### Metode 3: Menggunakan Supabase CLI

Jika Anda menggunakan Supabase CLI:

```bash
# Login ke Supabase
supabase login

# Link ke project
supabase link --project-ref your-project-ref

# Jalankan migration via CLI
supabase db push
```

Atau copy SQL langsung:

```bash
supabase db execute --file database/aop_performance_indexes.sql
supabase db execute --file database/aop_stats_function.sql
```

## Verifikasi Migration

Setelah migration selesai, verifikasi dengan query berikut di Supabase SQL Editor:

### 1. Cek Indexes

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'site_data_aop'
  AND indexname LIKE 'idx_site_data_aop%'
ORDER BY indexname;
```

Anda harus melihat minimal 15 indexes terdaftar.

### 2. Cek Function

```sql
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'get_aop_stats';
```

Anda harus melihat function `get_aop_stats` terdaftar.

### 3. Test Function

```sql
-- Test function dengan parameter kosong (semua data)
SELECT * FROM get_aop_stats();

-- Test function dengan filter
SELECT * FROM get_aop_stats(
  p_vendor_names := ARRAY['Nokia Solutions and Networks Indonesia'],
  p_program_reports := NULL,
  p_circles := NULL,
  p_site_categories := NULL,
  p_search := NULL
);
```

## Troubleshooting

### Error: "relation site_data_aop does not exist"
- Pastikan tabel `site_data_aop` sudah ada di database
- Cek nama tabel di Supabase Dashboard > Table Editor

### Error: "permission denied"
- Pastikan Anda menggunakan service role key atau memiliki permission untuk CREATE INDEX dan CREATE FUNCTION
- Di Supabase Dashboard, pastikan Anda login sebagai owner project

### Error: "index already exists"
- Tidak masalah, migration menggunakan `CREATE INDEX IF NOT EXISTS`
- Index yang sudah ada akan di-skip

### Function tidak berfungsi
- Pastikan function sudah dibuat dengan benar
- Cek syntax error di SQL Editor
- Pastikan semua parameter type sesuai

## Rollback (Jika Perlu)

Jika perlu rollback migration:

```sql
-- Drop function
DROP FUNCTION IF EXISTS get_aop_stats;

-- Drop indexes (opsional, tidak disarankan karena akan mengurangi performa)
-- Hanya lakukan jika benar-benar perlu
DROP INDEX IF EXISTS idx_site_data_aop_vendor_name;
DROP INDEX IF EXISTS idx_site_data_aop_program_report;
-- ... (dan seterusnya untuk semua indexes)
```

## Setelah Migration

Setelah migration berhasil:

1. ✅ Test aplikasi AOP page
2. ✅ Monitor query performance di Supabase Dashboard > Database > Query Performance
3. ✅ Verifikasi bahwa stats calculation lebih cepat
4. ✅ Check bahwa filter options loading lebih cepat

## Support

Jika ada masalah dengan migration:
1. Cek error message di Supabase Dashboard
2. Pastikan semua dependencies terpenuhi
3. Verifikasi struktur tabel `site_data_aop` sesuai dengan yang diharapkan

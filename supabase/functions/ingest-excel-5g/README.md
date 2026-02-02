# Edge Function: ingest-excel-5g

Upload Excel file from Postman **langsung ke Supabase** (tanpa Next.js/Vercel). File Excel di-parse dan di-upsert ke tabel `site_data_5g`.

**Batasan (WORKER_LIMIT):** Edge Function punya limit memori ~256MB dan CPU ~2 detik. Untuk file besar bisa error `WORKER_LIMIT`. Gunakan file **kecil saja** di sini:
- **Max 1MB** ukuran file
- **Max 300 baris** data (row 3+)

Untuk file lebih besar, pakai **Next.js API**: `POST /api/hermes-5g/upload-excel` (jika sudah ada) atau pecah Excel jadi beberapa file kecil.

## URL

```
POST https://opecotutdvtahsccpqzr.supabase.co/functions/v1/ingest-excel-5g
```

## Postman

1. **Method:** `POST`
2. **URL:** `https://opecotutdvtahsccpqzr.supabase.co/functions/v1/ingest-excel-5g`
3. **Body:** pilih `form-data`
   - Key: `file` | Type: **File** | Value: pilih file Excel (.xlsx, .xls, .xlsm)
4. **Headers:** (opsional)  
   - `Authorization: Bearer <SUPABASE_ANON_KEY>` — tidak wajib karena `verify_jwt: false`

## Format Excel

- **Row 1:** kosong (di-skip)
- **Row 2:** header (nama kolom, harus match dengan kolom `site_data_5g`)
- **Row 3+:** data
- **Wajib:** setiap baris punya kolom `system_key` (non-empty)

## Response

- **200:** `{ success: true, totalRows, insertedCount, errorCount, errors[] }`
- **400:** validasi/parse error
- **500:** server error

## Deploy ulang (jika perlu)

- Via **Supabase CLI:**  
  `supabase login` lalu  
  `supabase functions deploy ingest-excel-5g --project-ref opecotutdvtahsccpqzr`
- Via **MCP:** gunakan tool `deploy_edge_function` dengan `files` berisi isi `index.ts` dan import `xlsx@0.18.5` (esm.sh).

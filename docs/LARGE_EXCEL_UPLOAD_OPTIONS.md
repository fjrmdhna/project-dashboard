# Opsi Solusi: Upload Excel Besar (Lewat Limit Vercel & Edge Function)

## Masalah

| Platform | Limit utama |
|----------|-------------|
| **Supabase Edge Function** | ~256MB RAM, ~2s CPU → `WORKER_LIMIT` |
| **Vercel Serverless** | Body **4.5MB**, timeout 15s (default), memory 2–4GB |

Jadi: kirim file Excel besar sekaligus ke Vercel atau Edge Function bisa kena limit (payload too large / timeout / WORKER_LIMIT).

---

## Opsi Solusi

### Opsi 1: Upload ke Supabase Storage dulu, lalu proses dari Vercel (payload kecil)

**Alur:**
1. Postman: **upload file Excel ke Supabase Storage** (bukan ke Vercel). Storage tidak pakai limit body 4.5MB dari Vercel.
2. Postman atau script: **panggil API Vercel dengan body kecil** `{ "filePath": "hermes-5g-uploads/namafile.xlsx" }`.
3. API Vercel: **download file dari Storage** (stream ke memory), parse Excel, insert ke `site_data_5g` per batch.

**Keuntungan:** Satu file besar dari Postman; Vercel tidak menerima file di body, jadi tidak kena 4.5MB.  
**Batasan:** File harus muat di memory Vercel (2–4GB). Waktu proses harus di bawah timeout (atur `maxDuration` di Vercel, mis. 60s).

---

### Opsi 2: Halaman web (browser) – parse di client, kirim batch ke Supabase

**Alur:**
1. User buka halaman di app (mis. `/hermes-5g/upload`).
2. Pilih file Excel → **browser parse** (library xlsx di frontend).
3. Frontend **kirim data ke Supabase** per batch (mis. 200 baris per request) pakai Supabase client / REST.

**Keuntungan:** Tidak ada server yang parse file; tidak kena limit Vercel/Edge.  
**Batasan:** Tergantung RAM browser; untuk puluhan ribu baris biasanya masih bisa.

---

### Opsi 3: Script lokal (Node/Python)

**Alur:**
1. Script di komputer user: baca Excel, **pecah jadi batch** (mis. 500 baris per batch).
2. Setiap batch: **POST ke Supabase REST** `site_data_5g` (langsung ke Supabase, bukan lewat Vercel/Edge).
3. Postman tidak wajib; bisa dijalankan dari terminal.

**Keuntungan:** File sebesar apa pun bisa, selama muat di disk/RAM lokal. Tidak pakai quota Vercel/Edge.  
**Batasan:** User harus jalankan script (Node/Python + dependency).

---

### Opsi 4: Pecah file manual / banyak request

**Alur:**
1. Excel dipecah jadi beberapa file kecil (manual atau script) — mis. max 300 baris per file.
2. Di Postman: **kirim satu per satu** ke Edge Function `ingest-excel-5g` (atau ke API Vercel jika ada).

**Keuntungan:** Tidak perlu ubah arsitektur; pakai endpoint yang sudah ada.  
**Batasan:** Proses manual / banyak klik.

---

## Rekomendasi

- **Tetap pakai Postman + satu file besar:** pakai **Opsi 1** (upload ke Storage, lalu API Vercel proses dengan `filePath`).
- **Mau tanpa limit server:** pakai **Opsi 2** (halaman upload di browser) atau **Opsi 3** (script lokal).

Implementasi Opsi 1: API route **POST /api/hermes-5g/process-storage-file** yang menerima `{ "filePath": "path/di/bucket" }`, download dari Storage, parse, insert ke `site_data_5g`. Konfigurasi Vercel: `maxDuration` 60s, memory 1024MB.

---

## Cara Pakai Opsi 1 (Postman)

### 1. Buat bucket di Supabase (sekali saja)

- Dashboard Supabase → Storage → New bucket
- Nama: **hermes-5g-uploads**
- Public: off (private). Policy: izinkan insert/select untuk role yang dipakai (anon atau service_role sesuai kebutuhan).

### 2. Upload file Excel ke Storage (Postman)

- **Method:** POST  
- **URL:** `https://opecotutdvtahsccpqzr.supabase.co/storage/v1/object/hermes-5g-uploads/<nama-file>.xlsx`  
  Ganti `<nama-file>.xlsx` dengan nama file (mis. `site_5g_jan.xlsx`).
- **Headers:**
  - `Authorization: Bearer <SUPABASE_ANON_KEY atau SERVICE_ROLE_KEY>`
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (atau biarkan Postman set otomatis)
- **Body:** binary — pilih file Excel.

Atau pakai **Supabase Storage API** dengan path:  
`/storage/v1/object/hermes-5g-uploads/<path>` — body = raw file.

### 3. Panggil API Vercel (payload kecil)

- **Method:** POST  
- **URL:** `https://<domain-vercel-kamu>/api/hermes-5g/process-storage-file`  
- **Headers:** `Content-Type: application/json`  
- **Body (raw JSON):**  
  `{ "filePath": "site_5g_jan.xlsx" }`  
  (atau path lengkap di dalam bucket, mis. `2025/site_5g_jan.xlsx`)

Response: `{ success, totalRows, insertedCount, errorCount, errors }`.

**Env di Vercel:** set `SUPABASE_SERVICE_ROLE_KEY` (dan `NEXT_PUBLIC_SUPABASE_URL` jika belum) agar API bisa download dari Storage dan insert ke `site_data_5g`.

# 📘 Guide Postman untuk API TLP (site_data_tlp) - Updated dengan API Key

## 🔐 Autentikasi API Key

Semua endpoint TLP sekarang memerlukan **API Key** untuk autentikasi. API key dapat dikirim melalui:
- **Header**: `X-API-Key` (Recommended)
- **Query Parameter**: `apiKey` atau `api_key`

### Setup API Key

1. **Set Environment Variable** di server:
   ```bash
   # .env atau .env.local
   TLP_API_KEY=your-secret-api-key-here
   # atau
   API_KEY=your-secret-api-key-here
   ```

2. **Jika tidak ada API key di environment**, endpoint akan tetap bisa diakses (untuk development), tapi akan ada warning di console.

---

## 🔧 Setup Awal Postman

### 1. Base URL
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### 2. Environment Variables di Postman

Buat environment di Postman dengan variables:
- `base_url`: `http://localhost:3000`
- `api_key`: `your-secret-api-key-here`

---

## 📤 1. Upload Excel File

### Endpoint
```
POST {{base_url}}/api/tlp/upload-excel
```

### Konfigurasi Request

#### Method & URL
- Method: `POST`
- URL: `{{base_url}}/api/tlp/upload-excel`

#### Headers
Tambahkan header untuk API key:
```
X-API-Key: {{api_key}}
```

**ATAU** gunakan query parameter:
```
{{base_url}}/api/tlp/upload-excel?apiKey={{api_key}}
```

#### Body
1. Pilih tab `Body`
2. Pilih `form-data`
3. Tambahkan key dengan tipe `File`:
   - Key: `file`
   - Type: `File` (dropdown di sebelah kanan)
   - Value: Klik `Select Files` dan pilih file Excel (.xlsx, .xls, .xlsm)

#### Contoh Screenshot Setup:
```
┌─────────────────────────────────────┐
│ Headers                             │
│ Key              Value              │
│ X-API-Key       {{api_key}}        │
│                                     │
│ Body                                 │
│ ○ none  ○ form-data  ○ x-www...     │
│                                      │
│ Key          Type      Value         │
│ file         File      [Select...]  │
└─────────────────────────────────────┘
```

### ⚠️ Format Excel yang Diperlukan

**PENTING**: Excel file harus mengikuti format berikut:

- **Row 1**: Harus **KOSONG** (akan di-skip otomatis)
- **Row 2**: **Header row** (nama kolom seperti `system_key`, `SBOQ.project_type`, dll)
- **Row 3+**: **Data rows** (data yang akan di-upload)

#### Contoh Format Excel:
```
Row 1: [KOSONG - tidak ada data apapun]
Row 2: system_key | SBOQ.project_type | network_header | project_name | program_name | site_id | ...
Row 3: WO25039... | TLP | Jakarta Shield | 12JKB0696 | SAWAH | Active | ...
Row 4: WO25040... | TLP | Jakarta Shield | 12JKB0697 | SAWAH | Active | ...
...
```

#### Requirements:
- Format file: `.xlsx`, `.xls`, atau `.xlsm`
- Ukuran maksimal: **10MB**
- Kolom `system_key` **wajib ada** di header (row 2) dan **tidak boleh kosong** di setiap data row
- Header row (row 2) harus berisi nama kolom yang sesuai dengan database

### Response Unauthorized (401)
```json
{
  "status": "error",
  "message": "Unauthorized",
  "error": "API key is required. Provide it via X-API-Key header or apiKey query parameter.",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Response Invalid API Key (401)
```json
{
  "status": "error",
  "message": "Unauthorized",
  "error": "Invalid API key.",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## 📥 2. Get Data (dengan Pagination & Filter)

### Endpoint
```
GET {{base_url}}/api/tlp
```

### Konfigurasi Request

#### Method & URL
- Method: `GET`
- URL: `{{base_url}}/api/tlp`

#### Headers
Tambahkan header untuk API key:
```
X-API-Key: {{api_key}}
```

**ATAU** gunakan query parameter:
```
{{base_url}}/api/tlp?apiKey={{api_key}}&page=1&pageSize=50
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apiKey` atau `api_key` | string | **Yes** | - | API Key untuk autentikasi (jika tidak pakai header) |
| `page` | number | No | `1` | Halaman yang diminta |
| `pageSize` | number | No | `50` | Jumlah data per halaman (max: 100) |
| `search` | string | No | - | Pencarian di system_key, site_id, site_name, vendor_code, project_name |
| `regionFilter` atau `region` | string | No | `all` | Filter berdasarkan region |
| `vendorFilter` atau `vendor` | string | No | `all` | Filter berdasarkan vendor_code |
| `programFilter` atau `program` | string | No | `all` | Filter berdasarkan program_name |
| `sortBy` | string | No | `created_at` | Kolom untuk sorting |
| `sortOrder` | string | No | `desc` | `asc` atau `desc` |

### Contoh Request

#### A. Get All Data dengan Header API Key
```
GET {{base_url}}/api/tlp
Headers:
  X-API-Key: {{api_key}}
```

#### B. Get Data dengan Query Parameter API Key
```
GET {{base_url}}/api/tlp?apiKey={{api_key}}&page=1&pageSize=20
```

#### C. Get Data dengan Search dan Filter
```
GET {{base_url}}/api/tlp?apiKey={{api_key}}&search=WO25039&region=JRO&vendor=960/AJ0-AJF/PRC/24
```

#### D. Complete Example dengan Header
```
GET {{base_url}}/api/tlp?page=1&pageSize=25&search=WO25039&region=JRO&sortBy=created_at&sortOrder=desc
Headers:
  X-API-Key: {{api_key}}
```

### Setup di Postman (Headers Tab)
```
┌─────────────────────────────────────┐
│ Headers                             │
│ Key              Value              │
│ X-API-Key       {{api_key}}        │
└─────────────────────────────────────┘
```

### Setup di Postman (Query Params Tab)
```
┌─────────────────────────────────────┐
│ Params                              │
│ Key              Value    ✓         │
│ apiKey           {{api_key}} ✓      │
│ page             1        ✓         │
│ pageSize         50       ✓         │
│ search           WO25039  ✓         │
│ regionFilter     JRO      ✓         │
└─────────────────────────────────────┘
```

---

## 🔍 3. Get Filter Options

### Endpoint
```
GET {{base_url}}/api/tlp/filter-options
```

### Konfigurasi Request

#### Method & URL
- Method: `GET`
- URL: `{{base_url}}/api/tlp/filter-options`

#### Headers
Tambahkan header untuk API key:
```
X-API-Key: {{api_key}}
```

**ATAU** gunakan query parameter:
```
{{base_url}}/api/tlp/filter-options?apiKey={{api_key}}
```

---

## 📋 Postman Collection dengan API Key

### Import Collection JSON

```json
{
  "info": {
    "name": "TLP API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Upload Excel",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            }
          ]
        },
        "url": {
          "raw": "{{base_url}}/api/tlp/upload-excel",
          "host": ["{{base_url}}"],
          "path": ["api", "tlp", "upload-excel"]
        }
      }
    },
    {
      "name": "Get Data",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/tlp?page=1&pageSize=50",
          "host": ["{{base_url}}"],
          "path": ["api", "tlp"],
          "query": [
            {
              "key": "page",
              "value": "1"
            },
            {
              "key": "pageSize",
              "value": "50"
            }
          ]
        }
      }
    },
    {
      "name": "Get Filter Options",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/tlp/filter-options",
          "host": ["{{base_url}}"],
          "path": ["api", "tlp", "filter-options"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "api_key",
      "value": "your-secret-api-key-here"
    }
  ]
}
```

---

## 🔑 Cara Menggunakan API Key

### Method 1: Header (Recommended)
```
X-API-Key: your-secret-api-key-here
```

### Method 2: Query Parameter
```
?apiKey=your-secret-api-key-here
atau
?api_key=your-secret-api-key-here
```

### Method 3: Postman Environment Variable
1. Buat Environment di Postman
2. Tambahkan variable `api_key` dengan value API key Anda
3. Gunakan `{{api_key}}` di header atau query parameter

---

## ⚙️ Setup Environment Variable di Server

### Development (.env.local)
```bash
TLP_API_KEY=dev-secret-key-12345
```

### Production
```bash
TLP_API_KEY=prod-secret-key-xyz789
```

**Catatan**: Jika environment variable tidak di-set, endpoint akan tetap bisa diakses (untuk development), tapi akan ada warning di console.

---

## 🐛 Troubleshooting

### Error: "API key is required"
- Pastikan Anda mengirim API key melalui header `X-API-Key` atau query parameter `apiKey`
- Cek apakah environment variable `TLP_API_KEY` atau `API_KEY` sudah di-set di server

### Error: "Invalid API key"
- Pastikan API key yang Anda kirim sama dengan yang ada di environment variable
- Cek case sensitivity (API key case-sensitive)
- Pastikan tidak ada spasi di awal atau akhir API key

### Endpoint bisa diakses tanpa API key
- Ini berarti environment variable `TLP_API_KEY` atau `API_KEY` belum di-set
- Untuk production, pastikan untuk selalu set API key

---

## ✅ Best Practices

1. **Gunakan Header** untuk API key (lebih aman daripada query parameter)
2. **Jangan commit** API key ke repository (gunakan .env.local yang di-gitignore)
3. **Gunakan environment variables** di Postman untuk kemudahan
4. **Rotate API key** secara berkala untuk keamanan
5. **Gunakan API key berbeda** untuk development dan production

---

## 📝 Checklist Testing

- [ ] Set environment variable `TLP_API_KEY` di server
- [ ] Test upload Excel dengan API key di header
- [ ] Test upload Excel dengan API key di query parameter
- [ ] Test Get Data dengan API key
- [ ] Test Get Filter Options dengan API key
- [ ] Test tanpa API key (harus return 401)
- [ ] Test dengan API key salah (harus return 401)

---

Sekarang semua endpoint TLP sudah dilindungi dengan API key authentication! 🔒


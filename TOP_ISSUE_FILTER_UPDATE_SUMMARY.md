# Update Filter TopIssueCard - Tambah Pengecualian "20. 5G Activation Done"

## Analisis Filter yang Diterapkan

### Filter Existing di TopIssueCard
- **File**: `src/app/api/hermes-5g/top-5-issue/route.ts`
- **Lokasi**: Baris 67-72
- **Filter yang sudah ada**:
  - `"No Issue"` - Dikecualikan dari chart dan perhitungan
  - `"CAF NY Submit"` - Dikecualikan dari chart dan perhitungan

### Implementasi Filter
```typescript
// Filter out "No Issue", "CAF NY Submit", and "20. 5G Activation Done" categories
const filteredCategories = Object.entries(categoryCount).filter(([category]) => 
  !category.toLowerCase().includes('no issue') &&
  !category.toLowerCase().includes('caf ny submit') &&
  !category.toLowerCase().includes('20. 5g activation done')
);
```

## Perubahan yang Dilakukan

### 1. Tambah Pengecualian Baru
- **Kategori**: `"20. 5G Activation Done"`
- **Alasan**: Kategori ini menunjukkan status "done" yang tidak perlu ditampilkan sebagai issue
- **Implementasi**: Case-insensitive matching dengan `toLowerCase()`

### 2. Update Komentar
- **Sebelum**: `// Filter out "No Issue" and "CAF NY Submit" categories`
- **Sesudah**: `// Filter out "No Issue", "CAF NY Submit", and "20. 5G Activation Done" categories`

## Dampak Perubahan

### ✅ Yang Akan Terpengaruh
1. **Chart Display**: "20. 5G Activation Done" tidak akan muncul di pie chart
2. **Issue List**: Tidak akan ditampilkan di daftar 5 top issue
3. **Perhitungan Total**: Tidak akan dihitung dalam `top5Count` dan `filteredTotalCount`
4. **Tooltip**: Tidak akan muncul di tooltip chart

### ✅ Yang Tidak Terpengaruh
1. **Fungsionalitas Lain**: Semua fitur lain tetap berfungsi normal
2. **Filter Existing**: "No Issue" dan "CAF NY Submit" tetap dikecualikan
3. **API Response**: Struktur response tetap sama
4. **Performance**: Tidak ada dampak pada performa

## Verifikasi Data

### Data "20. 5G Activation Done" di Database
- **Jumlah Records**: Banyak records dengan kategori ini
- **Contoh Records**: 
  - `CP25015PTHWI015583` - GMFOFFICE_CM
  - `CP25015PTHWI015584` - GEDUNG_OPERASI_EP
  - `CP25015PTHWI015585` - MI_POLE_ACS_DT
  - Dan banyak lagi...

### Filter Logic
- **Case Insensitive**: Menggunakan `toLowerCase()` untuk matching yang robust
- **Partial Match**: Menggunakan `includes()` untuk menangkap variasi penulisan
- **Multiple Conditions**: Menggunakan `&&` untuk semua kondisi harus terpenuhi

## Testing yang Disarankan

### 1. Test API Endpoint
```bash
curl "http://localhost:3000/api/hermes-5g/top-5-issue"
```

### 2. Verifikasi Response
- Pastikan `"20. 5G Activation Done"` tidak ada di `data` array
- Pastikan `top5Count` dan `filteredTotalCount` tidak termasuk kategori ini
- Pastikan `"No Issue"` dan `"CAF NY Submit"` tetap dikecualikan

### 3. Test UI Component
- Buka halaman dashboard
- Periksa TopIssueCard
- Pastikan "20. 5G Activation Done" tidak muncul di chart atau list

## Kesimpulan

✅ **Filter berhasil ditambahkan** untuk mengecualikan "20. 5G Activation Done" dari TopIssueCard
✅ **Fungsionalitas existing** tetap terjaga
✅ **Tidak ada breaking changes** pada komponen lain
✅ **Performance** tidak terpengaruh
✅ **Code quality** terjaga dengan komentar yang jelas

Filter ini akan membantu dashboard menampilkan hanya issue yang benar-benar memerlukan perhatian, sambil menyembunyikan status "done" yang sudah selesai.

# Dokumentasi Dashboard — Analisis Spasial Ketimpangan Kemiskinan dan Klasterisasi Kesejahteraan Provinsi di Indonesia

## 1. Gambaran Umum

Dashboard ini merupakan aplikasi web interaktif yang memvisualisasikan **analisis spasial ketimpangan kemiskinan** dan **klasterisasi kesejahteraan** 38 provinsi di Indonesia menggunakan pendekatan *Spatial Data Mining*.

### Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Peta Interaktif | Leaflet.js |
| Grafik | Chart.js |
| Data Geospasial | GeoJSON |
| Server | Python HTTP Server (development) |

### Cara Menjalankan

```powershell
cd dashboard
python -m http.server 8080
```

Buka browser ke `http://localhost:8080`

---

## 2. Struktur File

```
dashboard/
├── index.html                  # Layout utama dashboard
├── css/
│   └── style.css               # Styling light theme
├── js/
│   ├── data.js                 # Data 38 provinsi + definisi variabel/klaster/LISA
│   ├── map-core.js             # Inisialisasi Leaflet, utilitas warna, legend, info panel
│   ├── layer-choropleth.js     # Layer choropleth (variabel tunggal)
│   ├── layer-bivariate.js      # Layer peta bivariate
│   ├── layer-lisa.js           # Layer LISA Cluster Map
│   ├── layer-clustering.js     # Layer K-Means + toggle/comparison
│   ├── charts.js               # Chart.js bar chart profiling klaster
│   └── app.js                  # Routing tab, inisialisasi komponen
└── data/
    └── indonesia-38prov.geojson  # Batas administrasi 38 provinsi
```

---

## 3. Data yang Digunakan

### 3.1 Variabel (15 Indikator)

Setiap provinsi memiliki 15 variabel yang merepresentasikan dimensi kemiskinan dan kesejahteraan:

| Variabel | Label | Satuan | Arah* |
|---|---|---|---|
| `poverty_pct` | Persentase Penduduk Miskin | % | negative |
| `ipm` | Indeks Pembangunan Manusia | — | positive |
| `avg_school_years` | Rata-rata Lama Sekolah | tahun | positive |
| `exp_school_years` | Harapan Lama Sekolah | tahun | positive |
| `stunting_pct` | Prevalensi Stunting | % | negative |
| `sanitation_pct` | Akses Sanitasi Layak | % | positive |
| `clean_water_pct` | Akses Air Minum Layak | % | positive |
| `food_insecurity_pct` | Ketidakamanan Pangan | % | negative |
| `ikp` | Indeks Ketahanan Pangan | — | positive |
| `gini_ratio` | Gini Ratio | — | negative |
| `pop_density` | Kepadatan Penduduk | jiwa/km² | positive |
| `health_workers` | Tenaga Kesehatan per Kepadatan | — | positive |
| `tpt` | Tingkat Pengangguran Terbuka | % | negative |
| `economic_growth` | Laju Pertumbuhan Ekonomi | % | positive |
| `agri_worker_pct` | Pekerja Sektor Pertanian | % | negative |

**Arah**: `positive` = nilai tinggi = lebih baik (warna biru/hijau gelap), `negative` = nilai tinggi = lebih buruk (warna merah gelap).

### 3.2 Cakupan: 38 Provinsi

Termasuk 6 provinsi baru di Papua:
- Papua, Papua Barat, Papua Barat Daya, Papua Tengah, Papua Pegunungan, Papua Selatan

### 3.3 Sumber Data

Data yang digunakan adalah **dummy data** yang disimulasikan berdasarkan data BPS 2023-2024. Untuk penelitian sesungguhnya, ganti data di `js/data.js` dengan data riil.

---

## 4. Tab dan Fitur Dashboard

### 4.1 Overview (Ringkasan)

**Tujuan**: Memberikan gambaran umum distribusi kemiskinan di Indonesia secara visual.

| Komponen | Deskripsi |
|---|---|
| **Stat Cards** | 4 kartu statistik: Total Provinsi, Rata-rata Kemiskinan, Provinsi Termiskin, Provinsi Tersejahtera |
| **Peta Choropleth** | Peta warna gradient menunjukkan persentase penduduk miskin per provinsi |
| **Sidebar Info** | Hover → info singkat, Klik → info lengkap semua variabel (scrollable) |

**Konsep — Choropleth Map**:
Peta choropleth mewarnai setiap wilayah administrasi berdasarkan nilai satu variabel. Warna gelap = nilai tinggi, warna terang = nilai rendah. Pada tab ini, warna menunjukkan tingkat kemiskinan: kuning muda = rendah, biru tua = tinggi.

**Interaksi**:
- **Hover**: Menampilkan nama provinsi + nilai kemiskinan + IPM di panel info
- **Klik**: Menampilkan semua 15 variabel + klaster + kategori LISA di panel info yang bisa di-scroll
- **Klik area kosong**: Menghapus seleksi

---

### 4.2 Bivariate (Analisis Dua Variabel)

**Tujuan**: Menganalisis korelasi spasial antara dua variabel secara bersamaan.

| Komponen | Deskripsi |
|---|---|
| **Dropdown Variabel X** | Pilih variabel untuk sumbu horizontal |
| **Dropdown Variabel Y** | Pilih variabel untuk sumbu vertikal |
| **Peta Bivariate** | Peta warna 3×3 grid menunjukkan kombinasi kedua variabel |
| **Legend Bivariate** | Grid 3×3 warna dengan label sumbu |
| **Panduan "Cara Membaca"** | Penjelasan cara interpretasi warna |

**Konsep — Bivariate Choropleth Map**:
Peta bivariate memetakan **dua variabel sekaligus** ke satu peta menggunakan grid warna 3×3:
- Sumbuh horizontal = Variabel X (rendah → tinggi)
- Sumbuh vertikal = Variabel Y (rendah → tinggi)
- Setiap sel warna = kombinasi kategori X dan Y

Contoh interpretasi (Kemiskinan vs IPM):
- **Kanan-atas gelap**: Kemiskinan tinggi + IPM tinggi → *kontraproduktif* (jarang terjadi)
- **Kanan-bawah gelap**: Kemiskinan tinggi + IPM rendah → *korelasi negatif kuat* (umum)
- **Kiri-atas gelap**: Kemiskinan rendah + IPM tinggi → *korelasi positif kesejahteraan*
- **Kiri-bawah gelap**: Kemiskinan rendah + IPM rendah → *anomali*

**Interaksi**:
- Peta otomatis berubah saat dropdown X atau Y diganti
- Hover dan klik sama seperti tab Overview

---

### 4.3 Hotspot (LISA)

**Tujuan**: Mengidentifikasi *hotspot* dan *coldspot* kemiskinan menggunakan analisis autokorelasi spasial lokal.

| Komponen | Deskripsi |
|---|---|
| **Peta LISA Cluster Map** | Peta kategorikal dengan 5 warna LISA |
| **Legend** | Keterangan 5 kategori LISA |
| **Interpretasi Kategori** | Panel penjelasan tiap kategori LISA |
| **Info Panel** | Detail provinsi saat hover/klik |

**Konsep — LISA (Local Indicators of Spatial Association)**:

LISA mengukur **autokorelasi spasial lokal** — apakah suatu wilayah memiliki nilai yang mirip dengan tetangganya. Ini berbeda dengan Moran's I global yang hanya memberikan satu angka untuk seluruh peta. LISA menghasilkan satu nilai per wilayah, sehingga bisa mengidentifikasi **cluster lokal**.

5 Kategori LISA:

| Kode | Label | Warna | Makna |
|---|---|---|---|
| **HH** | High-High (Kantong Kemiskinan) | 🔴 Merah | Provinsi miskin dikelilingi provinsi miskin — **hotspot** kemiskinan |
| **LL** | Low-Low (Area Sejahtera) | 🔵 Biru | Provinsi sejahtera dikelilingi provinsi sejahtera — **coldspot** kemiskinan |
| **HL** | High-Low (Outlier Miskin) | 🟠 Oranye | Provinsi miskin dikelilingi provinsi sejahtera — **outlier** kemiskinan |
| **LH** | Low-High (Outlier Sejahtera) | 🟢 Hijau | Provinsi sejahtera dikelilingi provinsi miskin — **outlier** kesejahteraan |
| **NS** | Not Significant | ⚪ Abu-abu | Tidak ada pola spasial yang signifikan |

**Contoh Interpretasi**:
- NTT dan NTB berwarna merah (HH) → membentuk *kantong kemiskinan* di kawasan Nusa Tenggara
- Jawa-Bali berwarna biru (LL) → membentuk *area sejahtera* yang saling berdekatan
- Provinsi dengan warna abu-abu (NS) → kemiskinan tidak membentuk pola spasial yang jelas dengan tetangganya

---

### 4.4 Spatial Clustering (K-Means)

**Tujuan**: Mengelompokkan provinsi berdasarkan kemiripan profil kesejahteraan menggunakan algoritma K-Means, lalu membandingkan hasilnya dengan LISA.

| Komponen | Deskripsi |
|---|---|
| **Mode Toggle** | Tampilan satu peta dengan tombol ganti layer (K-Means / LISA) |
| **Mode Comparison** | Dua peta side-by-side (K-Means vs LISA) |
| **Profiling Cards** | Kartu karakteristik tiap klaster |
| **Bar Chart** | Perbandingan rata-rata variabel antar klaster |

**Konsep — K-Means Clustering**:

K-Means adalah algoritma *unsupervised learning* yang mengelompokkan data ke K kluster berdasarkan kemiripan fitur. Dalam konteks ini, setiap provinsi memiliki 15 variabel, dan K-Means mengelompokkan provinsi yang memiliki **profil kesejahteraan serupa** ke dalam klaster yang sama.

4 Klaster yang dihasilkan:

| Klaster | Warna | Karakteristik Utama |
|---|---|---|
| **1 — Sejahtera** | 🟢 Hijau | Kemiskinan rendah (<6%), IPM tinggi (>74), sanitasi baik (>80%) |
| **2 — Menengah Stabil** | 🔵 Biru | Kemiskinan sedang (5-10%), IPM menengah (70-75), pertumbuhan stabil |
| **3 — Rentan Pangan** | 🟡 Kuning | Kemiskinan tinggi (10-20%), stunting tinggi (25-35%), sanitasi rendah |
| **4 — Tertinggal** | 🔴 Merah | Kemiskinan sangat tinggi (>22%), IPM rendah (<65), stunting >35% |

**Perbedaan K-Means vs LISA**:
- **K-Means**: Mengelompokkan berdasarkan **kemiripan nilai variabel** (atribut), tanpa mempertimbangkan lokasi
- **LISA**: Mengelompokkan berdasarkan **kemiripan dengan tetangga** (spasial), tanpa mempertimbangkan nilai absolut
- Dua provinsi yang berjauhan bisa masuk klaster K-Means yang sama, tapi tidak bisa masuk kategori LISA yang sama (kecuali pola spasialnya mirip)

**Mode Comparison (Side-by-Side)**:
Menampilkan peta K-Means dan LISA secara berdampingan dengan zoom yang tersinkronisasi, sehingga pengguna bisa membandingkan langsung hasil kedua metode.

---

### 4.5 About (Tentang)

**Tujuan**: Menjelaskan metodologi dan sumber data dashboard.

Berisi penjelasan tentang:
- Metodologi analisis (Choropleth, Bivariate, LISA, K-Means)
- Definisi variabel
- Sumber dan keterbatasan data

---

## 5. Fitur Interaksi

### 5.1 Hover

Saat mouse berada di atas provinsi:
- Provinsi di-highlight (border tebal)
- Panel info menampilkan ringkasan (3-4 variabel utama)

### 5.2 Klik

Saat provinsi diklik:
- Provinsi di-select (border lebih tebal + fill lebih solid)
- Panel info menampilkan **semua 15 variabel + klaster + kategori LISA**
- Panel info bisa di-scroll karena konten lengkap
- Seleksi bersifat persisten sampai diklik provinsi lain atau area kosong

### 5.3 Deselect

- Klik area kosong peta → menghapus seleksi
- Ganti tab → seleksi tetap tersimpan per peta

### 5.4 Zoom Sync (Comparison Mode)

Pada mode Comparison, zoom dan pan kedua peta tersinkronisasi — menggeser satu peta akan menggeser peta lainnya.

---

## 6. Konsep Statistik

### 6.1 Autokorelasi Spasial

Autokorelasi spasial mengukur sejauh mana suatu variabel berkorelasi dengan dirinya sendiri melalui ruang. Ada dua jenis:

- **Global** (Moran's I): Satu nilai untuk seluruh peta, menunjukkan apakah ada pola clustering secara keseluruhan
- **Lokal** (LISA): Satu nilai per wilayah, mengidentifikasi di mana cluster lokal terjadi

### 6.2 Spatial Data Mining

Pendekatan yang menggabungkan teknik data mining dengan analisis spasial:
1. **ESDA** (Exploratory Spatial Data Analysis): Memahami pola distribusi dan korelasi spasial
2. **Spatial Clustering**: Mengelompokkan wilayah berdasarkan kemiripan profil
3. **Hotspot Analysis**: Mengidentifikasi area dengan konsentrasi tinggi suatu fenomena

### 6.3 Bivariate Analysis

Analisis bivariate memungkinkan kita melihat **hubungan dua variabel secara spasial** sekaligus. Ini lebih informatif daripada dua peta terpisah karena menunjukkan **di mana** hubungan tertentu terjadi.

---

## 7. Keterbatasan

1. **Data Dummy**: Data yang digunakan adalah simulasi, bukan data BPS sesungguhnya
2. **LISA Simulasi**: Kategori LISA dihasilkan secara manual, bukan dari perhitungan Moran's I lokal yang sebenarnya
3. **K-Means Pre-computed**: Penentuan klaster dilakukan offline, bukan dihitung secara real-time di dashboard
4. **Spatial Weight**: Matriks bobot spasial (untuk LISA yang sebenarnya) tidak dihitung di dashboard
5. **GeoJSON**: Batas administrasi mungkin tidak sepenuhnya akurat untuk 6 provinsi Papua baru

---

## 8. Pengembangan Lanjutan

Untuk menjadikan dashboard ini lebih robust:

- [ ] Integrasikan data BPS sesungguhnya via API atau CSV
- [ ] Hitung LISA secara real-time menggunakan library seperti `geoda` atau `pygeoda`
- [ ] Implementasikan K-Means real-time dengan `ml.js` atau backend Python
- [ ] Tambahkan Moran's I scatter plot
- [ ] Tambahkan fitur filter berdasarkan pulau/klaster
- [ ] Export laporan ke PDF

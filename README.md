# 🚗 Simulator Ujian Teori SIM C - Korlantas POLRI

Sebuah aplikasi web simulasi ujian teori Surat Izin Mengemudi (SIM) Golongan C interaktif yang dibangun berdasarkan materi resmi Buku Panduan Korlantas POLRI. Aplikasi ini dirancang dengan antarmuka modern, responsif, dan premium (dark mode dengan aksen glassmorphism) untuk memudahkan masyarakat mempelajari materi ujian secara efektif.

---

## 📊 Cakupan Materi (100% Coverage)

Aplikasi ini mencakup seluruh **260 soal** dari Buku Panduan Latihan Ujian Teori SIM C yang dibagi ke dalam 4 modul:

1. **Persepsi Bahaya (100 Soal)**: Menguji sensitivitas dan ketepatan tindakan pengendara motor saat menghadapi potensi bahaya di jalan (misal: kendaraan parkir, penyeberang jalan, jalan berlubang).
2. **Wawasan (80 Soal)**: Membahas etika berkendara, tata tertib lalu lintas, keselamatan jalan, dan hak-hak sesama pengguna jalan.
3. **Pengetahuan (80 Soal)**: Membahas arti rambu lalu lintas (peringatan, larangan, perintah, petunjuk), marka jalan, dan undang-undang lalu lintas (UU No. 22 Tahun 2009).

---

## ✨ Fitur Utama

- 🏠 **Dashboard Statistik**: Memantau progres belajar secara real-time (jumlah soal yang dikuasai/ditandai) dan menampilkan skor hasil ujian terakhir.
- 📚 **Mode Belajar (Study Mode)**:
  - Telusuri soal per Modul (1-4) atau per Kategori (Persepsi Bahaya, Wawasan, Pengetahuan).
  - Pembahasan dan kunci jawaban resmi dari Korlantas POLRI.
  - Penanda progres interaktif: Tandai soal sebagai **Kuasai (Paham)** atau **Belum Paham (Perlu Review)**. Data tersimpan otomatis di `localStorage` peramban Anda.
- ⏱️ **Mode Simulasi Ujian (Exam Mode)**:
  - Ujian simulasi dengan format realistik (30 soal acak yang ditarik secara proporsional dari 3 kategori soal).
  - Batas waktu ujian selama 30 menit dengan jam hitung mundur.
  - Pilihan ganda (A, B, C) dengan posisi opsi di-shuffle secara dinamis agar latihan tetap menantang.
  - Peta Soal Ujian (Grid Navigation Map) untuk melacak soal mana yang sudah atau belum dijawab.
  - Standar kelulusan minimum **70%** (minimal **21 soal benar**), sesuai standar kelulusan resmi.
- 📝 **Review Jawaban Lengkap**: Setelah ujian, lihat detail jawaban Anda, jawaban yang benar, serta pembahasan resmi Korlantas POLRI untuk setiap soal ujian.
- 🖼️ **Asset Gambar Asli**: Semua ilustrasi visual jalan, rambu lalu lintas, dan diagram dari buku panduan asli telah diekstrak dan terintegrasi 1-to-1 dengan soal.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini berjalan sepenuhnya di sisi klien (Client-Side) dan tidak membutuhkan basis data eksternal. Anda dapat menjalankannya dengan salah satu metode berikut:

### Metode 1: Menggunakan Node.js (Rekomendasi)

1. Pastikan Anda memiliki [Node.js](https://nodejs.org/) terinstal.
2. Jalankan perintah berikut untuk menjalankan server pengembangan lokal (Vite):
   ```bash
   npm run dev
   ```
3. Buka peramban (browser) dan akses alamat yang tertera di terminal (biasanya `http://localhost:5173`).

### Metode 2: Menggunakan Python (Tanpa Instalasi Dependensi)

Jika Anda memiliki Python terinstal di komputer, Anda bisa langsung menjalankan server HTTP sederhana:

```bash
python3 -m http.server 8080 --directory public
```

Buka peramban dan akses `http://localhost:8080`.

### Metode 3: Buka Langsung (Offline)

Anda juga bisa membuka file `public/index.html` secara langsung di browser (klik ganda file tersebut). Namun, beberapa browser membatasi permintaan HTTP lokal (`fetch` untuk berkas `questions.json`). Oleh karena itu, menggunakan **Metode 1** atau **Metode 2** sangat dianjurkan.

---

## 📁 Struktur Direktori Proyek

```text
ujian-sim/
├── public/                 # Berkas web utama
│   ├── images/             # Seluruh 260 aset gambar resmi hasil ekstraksi PDF
│   ├── app.js              # Logika interaktif aplikasi web
│   ├── index.html          # Halaman antarmuka utama (HTML5)
│   ├── styles.css          # Desain stylesheet premium (CSS3)
│   └── questions.json      # Database 260 soal lengkap dengan pilihan ganda hasil pemetaan
├── Sim-C-Modul-[1-4].pdf   # Buku panduan modul asli Korlantas POLRI
├── package.json            # Konfigurasi npm scripts untuk Vite dev server
├── parse_modules.py        # Python script yang mengekstrak teks modul PDF
└── extract_and_map_all.py  # Python script yang memetakan gambar & membuat pilihan ganda
```

---
*Dibuat untuk membantu mensimulasikan dan mensukseskan ujian teori SIM C Anda! Selamat belajar dan berkendara dengan aman! 🏍️*

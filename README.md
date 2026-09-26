# Stock Opname — Luthfi Barnik

Sistem pendataan barang & stock opname untuk Luthfi Barnik (Duri, Riau).
Next.js 16 + Supabase (Auth, Database, RLS) + Google Sheets (snapshot) +
Discord (notifikasi). Dibuat menggantikan sistem lama berbasis Google
Apps Script + Google Sheets.

Proyek ini sudah diverifikasi bisa di-build (`npm run build`) dan lolos
`npx eslint .` tanpa error di lingkungan pengembangan. Yang BELUM bisa
diverifikasi dari sini: proyek Supabase sungguhan belum ada, jadi alur
login/database belum pernah dites terhadap server asli — ikuti langkah
di bawah lalu tes sendiri sebelum dipakai di lapangan.

## Daftar isi
1. [Yang sudah dikerjakan vs yang belum (Fase 2)](#1-yang-sudah-dikerjakan-vs-yang-belum-fase-2)
2. [Arsitektur singkat](#2-arsitektur-singkat)
3. [Prasyarat](#3-prasyarat)
4. [Setup Supabase](#4-setup-supabase)
5. [Setup lokal (VS Code)](#5-setup-lokal-vs-code)
6. [Membuat login staf pertama](#6-membuat-login-staf-pertama)
7. [Setup Discord webhook](#7-setup-discord-webhook)
8. [Setup Google Sheets](#8-setup-google-sheets)
9. [Deploy ke Vercel](#9-deploy-ke-vercel)
10. [Struktur folder](#10-struktur-folder)
11. [Pertanyaan yang masih perlu dijawab](#11-pertanyaan-yang-masih-perlu-dijawab)

---

## 1. Yang sudah dikerjakan vs yang belum (Fase 2)

**Sudah jadi & berfungsi (sesuai desain yang kita sepakati):**
- Login PIN → sesi Supabase Auth asli (bukan PIN yang dikirim ke browser)
- Rate limit percobaan PIN salah, per perangkat
- RLS penuh di semua tabel, per peran (admin/pic/ic/kepala_toko/spv/owner)
- Server-side lookup barang & lokasi (bukan download seluruh database)
- Cek duplikat, mode BARU/ADD/OVERWRITE, mode Pendataan Awal vs SO Harian
- Draft tersimpan di perangkat (localStorage), idempotency key saat kirim
- Submit atomik + advisory lock per lokasi (RPC `submit_so_batch`)
- Pembuatan otomatis permintaan pemenuhan saat qty ≤ stok minimum
- Alur pemenuhan: baru → disiapkan → display, atau → eskalasi ke Gudang Utama
- Notifikasi Discord (satu pesan berisi daftar) lewat webhook
- Dashboard ringkas (admin/ic/spv/owner)
- Sinkron ke Google Sheets sebagai snapshot (menimpa, bukan menumpuk baris)

**SENGAJA belum dikerjakan (supaya yang sudah ada jujur teruji, bukan
setengah jadi) — ini Fase 2:**
- **Scanner kamera di iPhone/Safari**: pakai `BarcodeDetector` bawaan
  browser, yang setahu saya belum didukung Safari iOS. Input manual
  selalu tersedia sebagai jalan keluar. Kalau PIC pakai iPhone, perlu
  pustaka cadangan (mis. `zxing-wasm`) — lihat §11.
- **Draft di IndexedDB**: masih localStorage. Cukup untuk draft satu sesi
  kerja (puluhan-ratusan item), tapi kalau pola pemakaian berubah
  (draft dibiarkan menumpuk berhari-hari), IndexedDB lebih tepat.
- **Ekspor Excel & PDF per sesi SO**: belum ada. Data historinya sudah
  lengkap di tabel `so_sessions`/`so_items`, tinggal ditambah route
  yang generate file (`exceljs` untuk xlsx, skill `pdf` untuk PDF).
- **Halaman admin untuk kelola staf & impor master barang/lokasi**: untuk
  sekarang pakai `scripts/create-staff.mjs` (staf) dan Supabase Studio /
  SQL untuk impor 6.300 SKU & 925 lokasi. Import awal sebesar itu
  sebaiknya lewat CSV → SQL `COPY`, bukan diketik satu-satu di sini.
- **Tombol interaktif di Discord**: sudah diputuskan cukup webhook saja,
  jadi ini memang tidak dikerjakan (bukan kelupaan).

## 2. Arsitektur singkat

```
Smartphone/Tablet/Laptop
        │
        ▼
Next.js 16 (App Router, Vercel)
  ├─ Server Component  → baca data langsung (RLS aktif, pakai sesi PIC)
  ├─ Route Handler      → aksi tervalidasi (login, submit, ubah status)
  └─ proxy.ts            → segarkan token sesi tiap request (bukan penjaga akses utama)
        │
        ▼
Supabase (Postgres + Auth + RLS)
  ├─ RPC submit_so_batch → satu transaksi atomik, advisory lock, idempotent
  └─ RLS per tabel        → per peran, dicek dari tabel profiles
        │
        ├──▶ Google Sheets API   (snapshot stok, untuk tim yang masih pakai sheet)
        └──▶ Discord Webhook     (notifikasi pemenuhan, satu pesan berisi daftar)
```

Kenapa auth-nya "PIN → sesi Supabase Auth asli", bukan sesi buatan
sendiri: dijelaskan di komentar `supabase/migrations/0001_schema.sql`
bagian `staff_credentials`. Singkatnya: PIN bukan password Supabase
Auth-nya; PIN cuma kunci pencarian, servernya diam-diam login pakai
password acak kuat yang tersimpan di tabel yang hanya bisa diakses
secret key. Ini trade-off yang sadar dipilih (bukan yang paling "murni"
secara teori) supaya RLS bisa langsung pakai `auth.uid()` tanpa OTP/magic
link yang menurut laporan pengguna lain kadang tidak stabil untuk login
berulang kali dalam waktu singkat.

## 3. Prasyarat

- **Node.js 20.9 atau lebih baru** (dites dengan Node 22). Cek: `node -v`
- **VS Code** (atau editor lain)
- Akun **Supabase** (gratis untuk mulai) — https://supabase.com
- Akun **Vercel** (gratis untuk mulai) — https://vercel.com
- Akun **GitHub** (untuk menghubungkan ke Vercel)
- Akses **Google Cloud Console** (untuk Google Sheets API)
- Akses **Discord** (untuk membuat webhook di server/channel kamu)

## 4. Setup Supabase

1. Buat project baru di https://supabase.com/dashboard → catat **Project URL**.
2. **Settings → API Keys** → catat `publishable` key (`sb_publishable_...`)
   dan `secret` key (`sb_secret_...`). Secret key JANGAN pernah dipakai di
   kode yang jalan di browser.
3. Buka **SQL Editor**, jalankan isi file-file ini **berurutan** (copy-paste,
   Run, satu per satu):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_rls.sql`
4. **(Opsional, untuk coba-coba lokal)** jalankan juga `supabase/seed.sql`
   untuk contoh 7 lokasi & 5 barang. **JANGAN** jalankan `seed.sql` di
   project produksi — isi barang & lokasi asli sebaiknya lewat impor CSV
   terpisah (lihat §11 soal skala 6.300 SKU).
5. **Authentication → Providers**: pastikan provider **Email** aktif
   (default aktif). Kita tidak memakai form daftar publik — semua akun
   staf dibuat lewat `scripts/create-staff.mjs` di §6.
6. Kalau nanti proyek ini punya domain sendiri, isi **Authentication →
   URL Configuration → Site URL** dengan domain Vercel kamu (langkah ini
   di §9).

Kalau lebih suka pakai Supabase CLI dari komputer sendiri (opsional,
tidak wajib): `npx supabase login`, lalu `npx supabase link --project-ref <ref>`,
lalu `npx supabase db push` akan menjalankan folder `supabase/migrations`
otomatis sesuai urutan nama filenya.

## 5. Setup lokal (VS Code)

```bash
# 1. Buka folder proyek ini di VS Code

# 2. Pasang semua dependency
npm install

# 3. Salin file environment
cp .env.example .env.local

# 4. Isi .env.local:
#    - NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY & SUPABASE_SECRET_KEY  -> dari langkah 4.2
#    - PIN_HMAC_SECRET  -> generate dengan:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#      (tempel hasilnya ke .env.local, SEKALI saja, jangan diubah lagi setelahnya)
#    - Google Sheets & Discord bisa dikosongkan dulu untuk coba-coba awal
#      (fiturnya akan gagal dengan pesan jelas, tidak bikin aplikasi crash)

# 5. Jalankan
npm run dev
```

Buka http://localhost:3000 — harusnya langsung diarahkan ke `/login`.

## 6. Membuat login staf pertama

PIN tidak bisa dibuat lewat form (sengaja, supaya tidak sembarang orang
bisa daftar sendiri). Buat lewat terminal, dari komputer kamu:

```bash
node --env-file=.env.local scripts/create-staff.mjs \
  --nama "Suhendri" --inisial SH --role admin --pin 1234
```

Ulangi untuk staf lain, ganti `--role` sesuai kebutuhan
(`admin`, `pic`, `ic`, `kepala_toko`, `spv`, `owner`). Simpan PIN-nya
dan beri tahu staf terkait secara langsung — sistem tidak mengirim PIN
lewat email/SMS.

Reset PIN staf yang lupa:
```bash
node --env-file=.env.local scripts/create-staff.mjs \
  --email <email-internal-staf-tsb> --reset --pin 9999
```
(email internalnya bisa dilihat di tabel `staff_credentials` lewat Supabase Studio)

## 7. Setup Discord webhook

1. Di server Discord kamu, buka channel `#stok-display` → **Edit Channel
   → Integrations → Webhooks → New Webhook** → copy URL-nya → tempel ke
   `DISCORD_WEBHOOK_STOK_DISPLAY` di `.env.local` (dan nanti di Vercel).
2. Ulangi untuk channel `#inventory-control` → `DISCORD_WEBHOOK_INVENTORY_CONTROL`.

## 8. Setup Google Sheets

1. Buka https://console.cloud.google.com → buat project (atau pakai yang
   sudah ada) → **APIs & Services → Library** → aktifkan **Google Sheets API**.
2. **IAM & Admin → Service Accounts → Create Service Account** → beri
   nama bebas (mis. `so-sheets-sync`) → **Keys → Add Key → JSON** →
   unduh file JSON-nya.
3. Dari file JSON itu, ambil:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (isi APA ADANYA
     termasuk `-----BEGIN PRIVATE KEY-----` dan `\n` di dalamnya —
     jangan dihapus, cukup dibungkus tanda kutip satu baris saat
     ditempel ke `.env.local` / kolom env Vercel)
4. Buka Google Sheet tujuan (yang masih dipakai tim lain) → **Share** →
   tempel email service account (`client_email`) → beri akses **Editor**.
5. Dari URL sheet, `.../d/<INI_ID_NYA>/edit`, salin ID-nya ke `GOOGLE_SHEET_ID`.
6. Buat satu tab baru di sheet itu khusus untuk snapshot ini, misalnya
   bernama `Stok Saat Ini` → isi `GOOGLE_SHEET_TAB` dengan nama itu.
   **Sengaja dibuat tab terpisah**, bukan menimpa tab yang sudah dipakai
   tim lain, supaya tidak ada yang berantakan.

## 9. Deploy ke Vercel

1. Push folder proyek ini ke repository GitHub baru (bisa lewat VS Code:
   Source Control → Publish Branch, atau `git init && git add . && git commit -m "awal" && git remote add origin <url> && git push -u origin main`).
2. Buka https://vercel.com/new → Import repository GitHub tadi.
3. Sebelum Deploy, buka **Environment Variables** → isi SEMUA variabel
   yang ada di `.env.example` dengan nilai asli (Supabase, PIN secret,
   Google, Discord). Vercel otomatis mendeteksi ini proyek Next.js.
4. Klik **Deploy**.
5. Setelah dapat domain (`https://nama-proyek.vercel.app`), kembali ke
   Supabase **Authentication → URL Configuration** → isi **Site URL**
   dengan domain itu.
6. Buka domain Vercel-nya, login pakai PIN admin yang sudah dibuat di §6.

## 10. Struktur folder

```
src/
  app/
    login/                halaman login (PIN pad)
    (app)/                 grup halaman yang butuh login (topbar+tabbar)
      hitung/               langkah 1: scan barang → lokasi → qty
      draft/                daftar draft + kirim
      pemenuhan/            antrean pemenuhan display
      riwayat/               histori sesi SO + kirim ke spreadsheet
      dashboard/             ringkasan (admin/ic/spv/owner)
      akun/                   sesi & keluar
    api/                    Route Handler (login, produk, lokasi, cek-isi,
                              submit, pemenuhan, sheet-sync)
  components/
    ui/                     komponen dasar gaya shadcn (Button, Input, dst)
    so/                     komponen khusus aplikasi (Scanner, AppShell, dst)
  lib/
    supabase/               tiga client: browser, server, admin
    so/                     guard peran, util PIN, draft store, Discord, Sheets
  types/database.ts        tipe tabel (tulis tangan, lihat catatan di file itu)
  proxy.ts                  penyegar sesi (pengganti middleware.ts di Next 16)
supabase/
  migrations/               skema, fungsi RPC, RLS -- jalankan berurutan
  seed.sql                  data contoh, HANYA untuk lokal
scripts/
  create-staff.mjs          buat/reset login staf (dijalankan manual)
```

## 11. Pertanyaan yang masih perlu dijawab

Supaya Fase 2 terarah, ini yang masih perlu kamu putuskan:

1. **Scanner iPhone**: perlu dicek langsung, PIC/tim toko yang pakai
   iPhone ada berapa banyak? Kalau ada, saya pasangkan pustaka cadangan
   (`zxing-wasm`, sedikit menambah ukuran halaman tapi jalan di semua HP).
2. **Impor awal 6.300 SKU & 925 lokasi**: sumber datanya dari mana
   (Accurate Online punya export CSV, atau dari sheet lama)? Ini
   menentukan bentuk skrip impor yang saya buatkan.
3. **Siapa yang boleh mengedit master barang/lokasi/harga** setelah
   sistem jalan — perlu halaman admin, atau cukup lewat Supabase Studio
   untuk sementara?
4. **Format ekspor Excel/PDF per sesi SO** — kolom apa saja yang dibutuhkan,
   ada contoh format dari sistem lama yang harus dipertahankan?

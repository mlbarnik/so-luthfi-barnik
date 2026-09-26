-- =========================================================================
-- 0001_schema.sql
-- Skema inti Stock Opname Luthfi Barnik.
-- Jalankan lewat: supabase db push  (atau tempel di SQL Editor Supabase)
-- =========================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- pencarian nama barang yang toleran typo

-- -------------------------------------------------------------------------
-- PROFILES
-- Satu baris per staf, 1:1 dengan auth.users. Ini yang dipakai RLS untuk
-- mengecek peran (role) siapa pun yang sedang login.
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nama       text not null,
  inisial    text not null,
  role       text not null check (role in ('admin','pic','ic','kepala_toko','spv','owner')),
  aktif      boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.profiles is
  'Identitas & peran staf. Peran menentukan RLS di semua tabel lain.';
comment on column public.profiles.role is
  'admin=IT/owner sistem, pic=petugas hitung, ic=Inventory Control, '
  'kepala_toko=kepala/asisten kepala toko (tandai "sudah didisplay"), '
  'spv=supervisor (lihat saja), owner=pemilik (lihat saja).';

-- -------------------------------------------------------------------------
-- STAFF_CREDENTIALS  — HANYA bisa diakses lewat secret key (service role).
-- Tidak ada RLS policy sama sekali di tabel ini = tertutup total untuk
-- anon & authenticated. Dipakai satu-satunya oleh route /api/auth/login.
--
-- Kenapa ada "internal_password"? Supabase Auth butuh password asli untuk
-- signInWithPassword(). PIN 4-6 digit BUKAN password Supabase Auth-nya --
-- PIN cuma kunci pencarian (lewat pin_hmac). Begitu PIN cocok, server
-- login diam-diam pakai internal_password (string acak kuat) yang
-- tersimpan di sini. Konsekuensinya: tabel ini jadi sangat sensitif,
-- jangan pernah expose lewat REST/RLS, dan secret key jangan pernah
-- bocor ke browser.
-- -------------------------------------------------------------------------
create table if not exists public.staff_credentials (
  id                uuid primary key references public.profiles(id) on delete cascade,
  email             text not null unique,
  pin_hmac          text not null unique,
  internal_password text not null,
  failed_attempts   int not null default 0,
  locked_until      timestamptz,
  updated_at        timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- LOGIN_THROTTLE — rate limit percobaan PIN yang SALAH (belum tentu
-- cocok ke staf manapun), dikunci per perangkat (device id di cookie).
-- Juga service-role-only.
-- -------------------------------------------------------------------------
create table if not exists public.login_throttle (
  kunci           text primary key,
  percobaan       int not null default 0,
  terkunci_sampai timestamptz,
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- LOCATIONS — rak, palet, showcase, floor, freezer, buffer gudang.
-- Kapasitas (min/maks) TIDAK di sini — itu per barang, lihat
-- location_thresholds.
-- -------------------------------------------------------------------------
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  kode       text not null unique,
  tipe       text not null check (tipe in ('rak','palet','showcase','floor','freezer','buffer')),
  area       text not null check (area in ('toko','gudang_lt3','gudang_utama')),
  lantai     text,
  zona       text,
  jenis      text,
  aktif      boolean not null default true,
  created_at timestamptz not null default now()
);
comment on column public.locations.area is
  'toko | gudang_lt3 (gudang bagian toko / buffer) | gudang_utama. '
  'SO dan pendataan boleh terjadi di ketiganya.';

-- -------------------------------------------------------------------------
-- PRODUCTS
-- -------------------------------------------------------------------------
create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  barcode    text not null unique,
  nama       text not null,
  satuan     text not null default 'PCS',
  kategori   text,
  harga      numeric(12,2),
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_nama_trgm_idx
  on public.products using gin (nama gin_trgm_ops);

-- -------------------------------------------------------------------------
-- LOCATION_THRESHOLDS — stok minimum & maksimum, PER BARANG PER LOKASI.
-- sumber = dari Accurate (Online) atau sementara dari hasil SO harian.
-- -------------------------------------------------------------------------
create table if not exists public.location_thresholds (
  product_id  uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  stok_min    int not null default 0,
  stok_maks   int not null default 0,
  sumber      text not null default 'so_harian' check (sumber in ('accurate','so_harian')),
  updated_at  timestamptz not null default now(),
  primary key (product_id, location_id)
);

-- -------------------------------------------------------------------------
-- STOCK — posisi (isi) barang saat ini per lokasi. Ini "kebenaran" yang
-- dibaca layar Hitung untuk cek duplikat & dashboard. Ditulis HANYA
-- lewat fungsi submit_so_batch (lihat 0002_functions.sql) — tidak ada
-- policy INSERT/UPDATE untuk role authenticated di tabel ini.
-- -------------------------------------------------------------------------
create table if not exists public.stock (
  product_id  uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  qty         int not null default 0,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  primary key (product_id, location_id)
);
create index if not exists stock_location_idx on public.stock(location_id);

-- -------------------------------------------------------------------------
-- SO_SESSIONS — satu baris per "Kirim draft" (satu batch submit).
-- idempotency_key datang dari klien dan tetap sama walau tombol Kirim
-- ditekan berkali-kali gara-gara koneksi lambat -> tidak dobel.
-- -------------------------------------------------------------------------
create table if not exists public.so_sessions (
  id               uuid primary key default gen_random_uuid(),
  kode             text not null unique,
  idempotency_key  text not null unique,
  pic_id           uuid not null references public.profiles(id),
  mode             text not null check (mode in ('awal','harian')),
  item_count       int not null default 0,
  total_qty        int not null default 0,
  sheet_synced_at  timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.so_items (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.so_sessions(id) on delete cascade,
  product_id     uuid not null references public.products(id),
  location_id    uuid not null references public.locations(id),
  qty            int not null,
  qty_sebelum    int,
  selisih        int,
  mode           text not null check (mode in ('BARU','ADD','OVERWRITE')),
  client_item_id text not null,
  created_at     timestamptz not null default now(),
  unique (session_id, client_item_id)
);
create index if not exists so_items_session_idx on public.so_items(session_id);

-- -------------------------------------------------------------------------
-- FULFILLMENT_REQUESTS — antrean "Pemenuhan display", dibuat otomatis
-- oleh submit_so_batch saat qty hasil SO <= stok_min lokasi tsb.
-- -------------------------------------------------------------------------
create table if not exists public.fulfillment_requests (
  id            uuid primary key default gen_random_uuid(),
  kode          text not null unique,
  product_id    uuid not null references public.products(id),
  location_id   uuid not null references public.locations(id),
  sisa          int not null,
  stok_min      int not null,
  target_isi    int not null,
  status        text not null default 'baru' check (status in ('baru','disiapkan','eskalasi','display')),
  catatan       text,
  so_session_id uuid references public.so_sessions(id),
  dibuat_at     timestamptz not null default now(),
  diubah_oleh   uuid references public.profiles(id),
  diubah_at     timestamptz
);
create index if not exists fulfillment_status_idx on public.fulfillment_requests(status);

-- -------------------------------------------------------------------------
-- SHEET_SYNC_LOG — jejak pengiriman ke Google Sheets (di luar transaksi
-- utama, lihat catatan arsitektur di README).
-- -------------------------------------------------------------------------
create table if not exists public.sheet_sync_log (
  id            uuid primary key default gen_random_uuid(),
  so_session_id uuid references public.so_sessions(id),
  status        text not null check (status in ('sukses','gagal')),
  pesan         text,
  baris_ditulis int,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- COUNTERS — helper penomoran kode (SO-YYMMDD-001, REQ-0001, dst).
-- -------------------------------------------------------------------------
create table if not exists public.counters (
  id    text primary key,
  value int not null default 0
);
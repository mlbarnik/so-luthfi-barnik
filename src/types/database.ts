/**
 * Tipe baris tabel Supabase, ditulis tangan supaya cocok dengan
 * supabase/migrations/0001_schema.sql.
 *
 * Perbaikan yang lebih tahan lama: generate otomatis dari project asli:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * File ini cukup dipakai sampai project Supabase-nya benar-benar ada.
 */

export type Peran = 'admin' | 'pic' | 'ic' | 'kepala_toko' | 'spv' | 'owner' | 'gm';
export type TipeLokasi = 'rak' | 'palet' | 'showcase' | 'floor' | 'freezer' | 'buffer';
export type AreaLokasi = 'toko' | 'gudang_lt3' | 'gudang_utama';
export type ModeSO = 'awal' | 'harian';
export type ModeItem = 'BARU' | 'ADD' | 'OVERWRITE';
export type StatusPemenuhan = 'baru' | 'disiapkan' | 'eskalasi' | 'display';

export interface Profile {
  id: string;
  nama: string;
  inisial: string;
  role: Peran;
  aktif: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  kode: string;
  tipe: TipeLokasi;
  area: AreaLokasi;
  lantai: string | null;
  zona: string | null;
  jenis: string | null;
  aktif: boolean;
}

export interface Product {
  id: string;
  barcode: string;
  nama: string;
  satuan: string;
  kategori: string | null;
  harga: number | null;
  aktif: boolean;
}

export interface LocationThreshold {
  product_id: string;
  location_id: string;
  stok_min: number;
  stok_maks: number;
  sumber: 'accurate' | 'so_harian';
}

export interface Stock {
  product_id: string;
  location_id: string;
  qty: number;
  updated_at: string;
  updated_by: string | null;
}

export interface SoSession {
  id: string;
  kode: string;
  idempotency_key: string;
  pic_id: string;
  mode: ModeSO;
  item_count: number;
  total_qty: number;
  sheet_synced_at: string | null;
  created_at: string;
}

export interface SoItem {
  id: string;
  session_id: string;
  product_id: string;
  location_id: string;
  qty: number;
  qty_sebelum: number | null;
  selisih: number | null;
  mode: ModeItem;
  client_item_id: string;
  created_at: string;
}

export interface FulfillmentRequest {
  id: string;
  kode: string;
  product_id: string;
  location_id: string;
  sisa: number;
  stok_min: number;
  target_isi: number;
  status: StatusPemenuhan;
  catatan: string | null;
  so_session_id: string | null;
  dibuat_at: string;
  diubah_oleh: string | null;
  diubah_at: string | null;
}

/** Payload item yang dikirim klien ke RPC submit_so_batch. */
export interface SubmitItemPayload {
  client_item_id: string;
  barcode: string;
  lokasi_kode: string;
  qty: number;
  mode: ModeItem;
}

export interface SubmitResult {
  session_id: string;
  kode: string;
  item_count: number;
  total_qty: number;
  new_requests: Array<{
    id: string;
    kode: string;
    barcode: string;
    nama: string;
    satuan: string;
    lokasi_kode: string;
    sisa: number;
    stok_min: number;
  }>;
  diulang: boolean;
}

/** Peta hak akses per peran — dipakai UI (nav, proxy, dan RLS server). */
export const HAK_AKSES: Record<Peran, { hitung: boolean; pemenuhanAksi: boolean; pemenuhanLihat: boolean; dashboard: boolean }> = {
  admin:       { hitung: true,  pemenuhanAksi: true,  pemenuhanLihat: true,  dashboard: true },
  pic:         { hitung: true,  pemenuhanAksi: false, pemenuhanLihat: false, dashboard: false },
  ic:          { hitung: true,  pemenuhanAksi: true,  pemenuhanLihat: true,  dashboard: true },
  kepala_toko: { hitung: false, pemenuhanAksi: true,  pemenuhanLihat: true,  dashboard: false },
  spv:         { hitung: false, pemenuhanAksi: false, pemenuhanLihat: true,  dashboard: true },
  owner:       { hitung: false, pemenuhanAksi: false, pemenuhanLihat: true,  dashboard: true },
  gm:          { hitung: false, pemenuhanAksi: false, pemenuhanLihat: true,  dashboard: true },
};
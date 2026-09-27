import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface BarisEksporItem {
  barcode: string; nama: string; satuan: string; lokasi_kode: string;
  mode: string; qty_sebelum: number | null; qty: number; selisih: number | null;
}
export interface DataEksporSesi {
  kode: string; mode: string; pic_nama: string; dibuat: string;
  item_count: number; total_qty: number; items: BarisEksporItem[];
}

/**
 * Dipakai bareng oleh route Excel & PDF supaya query dan aturan akses
 * (RLS lewat client biasa, BUKAN admin client) cuma ditulis sekali.
 * Mengembalikan null kalau sesi tidak ada / tidak boleh dilihat peran ini
 * -- RLS yang menentukan, bukan pengecekan peran manual di sini.
 */
export async function ambilDataEkspor(sessionId: string): Promise<DataEksporSesi | null> {
  const supabase = await createClient();

  const { data: sesi } = await supabase
    .from('so_sessions')
    .select('kode, mode, item_count, total_qty, created_at, profiles(nama)')
    .eq('id', sessionId)
    .maybeSingle<{
      kode: string; mode: string; item_count: number; total_qty: number;
      created_at: string; profiles: { nama: string } | null;
    }>();
  if (!sesi) return null;

  const { data: items } = await supabase
    .from('so_items')
    .select('qty, qty_sebelum, selisih, mode, products(barcode, nama, satuan), locations(kode)')
    .eq('session_id', sessionId)
    .returns<Array<{
      qty: number; qty_sebelum: number | null; selisih: number | null; mode: string;
      products: { barcode: string; nama: string; satuan: string } | null;
      locations: { kode: string } | null;
    }>>();

  return {
    kode: sesi.kode,
    mode: sesi.mode,
    pic_nama: sesi.profiles?.nama ?? '-',
    dibuat: sesi.created_at,
    item_count: sesi.item_count,
    total_qty: sesi.total_qty,
    items: (items ?? []).map((it) => ({
      barcode: it.products?.barcode ?? '-',
      nama: it.products?.nama ?? '-',
      satuan: it.products?.satuan ?? '',
      lokasi_kode: it.locations?.kode ?? '-',
      mode: it.mode,
      qty_sebelum: it.qty_sebelum,
      qty: it.qty,
      selisih: it.selisih,
    })),
  };
}
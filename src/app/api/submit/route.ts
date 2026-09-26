import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { profilAPI } from '@/lib/so/guard';
import { kirimDaftarPemenuhanKeDiscord } from '@/lib/so/discord';
import type { SubmitResult } from '@/types/database';

const ItemSchema = z.object({
  client_item_id: z.string().min(1),
  barcode: z.string().min(1),
  lokasi_kode: z.string().min(1),
  qty: z.number().int().min(0),
  mode: z.enum(['BARU', 'ADD', 'OVERWRITE']),
});
const BodySchema = z.object({
  idempotency_key: z.string().min(8),
  mode: z.enum(['awal', 'harian']),
  items: z.array(ItemSchema).min(1).max(200),
});

/**
 * POST /api/submit
 * Satu-satunya jalan menulis draft ke database. Semua validasi berat
 * (barcode & lokasi asli, kunci per lokasi, idempotency) terjadi di
 * dalam RPC submit_so_batch (lihat 0002_functions.sql) supaya benar-benar
 * atomik -- route ini cuma memanggilnya lalu mengirim notifikasi Discord.
 */
export async function POST(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  if (!['pic', 'ic', 'admin'].includes(sesi.profil.role)) {
    return NextResponse.json({ ok: false, error: 'Peran ini tidak boleh mengirim SO.' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Data draft tidak valid.' }, { status: 400 });
  }
  const { idempotency_key, mode, items } = parsed.data;

  const { data, error } = await sesi.supabase.rpc('submit_so_batch', {
    p_idempotency_key: idempotency_key,
    p_mode: mode,
    p_items: items.map((it) => ({
      client_item_id: it.client_item_id,
      barcode: it.barcode,
      lokasi_kode: it.lokasi_kode,
      qty: it.qty,
      mode: it.mode,
    })),
  });

  if (error) {
    const pesan = error.message.includes('BARANG_TIDAK_DITEMUKAN')
      ? 'Salah satu barcode tidak ada di master barang (mungkin master berubah sejak kamu mulai mendata).'
      : error.message.includes('LOKASI_TIDAK_DITEMUKAN')
      ? 'Salah satu kode lokasi tidak ada di master lokasi.'
      : error.message.includes('FORBIDDEN')
      ? 'Peran ini tidak boleh mengirim SO.'
      : 'Server tidak bisa menyimpan draft ini. Draft di perangkat tidak dihapus, coba kirim lagi.';
    return NextResponse.json({ ok: false, error: pesan }, { status: 400 });
  }

  const hasil = data as SubmitResult;

  if (hasil.new_requests.length > 0) {
    await kirimDaftarPemenuhanKeDiscord({
      channel: 'stok-display',
      judul: `Permintaan pemenuhan display — ${hasil.kode}`,
      soKode: hasil.kode,
      baris: hasil.new_requests.map((r) => ({
        nama: r.nama, lokasi: r.lokasi_kode, sisa: r.sisa, satuan: r.satuan,
        keterangan: r.sisa === 0 ? 'KOSONG' : `min ${r.stok_min}`,
      })),
    });
  }

  return NextResponse.json({ ok: true, ...hasil });
}

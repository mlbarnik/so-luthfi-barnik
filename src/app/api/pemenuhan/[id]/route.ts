import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { profilAPI } from '@/lib/so/guard';
import { kirimDaftarPemenuhanKeDiscord } from '@/lib/so/discord';

const BodySchema = z.object({
  status: z.enum(['disiapkan', 'eskalasi', 'display']),
  catatan: z.string().max(300).optional(),
});

/**
 * PATCH /api/pemenuhan/:id
 * Hanya admin / ic / kepala_toko yang boleh (dijaga RLS DAN dicek ulang
 * di sini supaya pesan errornya jelas untuk pengguna, bukan cuma "gagal").
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  if (!['admin', 'ic', 'kepala_toko'].includes(sesi.profil.role)) {
    return NextResponse.json({ ok: false, error: 'Peran ini tidak boleh mengubah status pemenuhan.' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid.' }, { status: 400 });
  const { status, catatan } = parsed.data;

  const { data, error } = await sesi.supabase
    .from('fulfillment_requests')
    .update({ status, catatan: catatan ?? null, diubah_oleh: sesi.profil.id, diubah_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, products(nama, satuan), locations(kode)')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Permintaan tidak ditemukan atau gagal diubah.' }, { status: 400 });
  }

  const channel = status === 'eskalasi' ? 'inventory-control' : 'stok-display';
  const judul = status === 'eskalasi'
    ? 'Diteruskan ke Gudang Utama'
    : status === 'display'
    ? 'Display sudah diisi'
    : 'Disiapkan tim Lantai 3';
  await kirimDaftarPemenuhanKeDiscord({
    channel,
    judul: `${judul} — ${data.locations?.kode}`,
    baris: [{
      nama: data.products?.nama ?? '-', lokasi: data.locations?.kode ?? '-',
      sisa: data.sisa, satuan: data.products?.satuan ?? '', keterangan: catatan,
    }],
  });

  return NextResponse.json({ ok: true, data });
}

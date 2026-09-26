import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';

/** GET /api/cek-isi?barcode=...&lokasi=... -> isi saat ini + ambang batas. */
export async function GET(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  const supabase = sesi.supabase;
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');
  const lokasiKode = searchParams.get('lokasi');
  if (!barcode || !lokasiKode) {
    return NextResponse.json({ ok: false, error: 'barcode dan lokasi wajib diisi.' }, { status: 400 });
  }

  const { data: produk } = await supabase.from('products').select('id').eq('barcode', barcode).maybeSingle();
  const { data: lokasi } = await supabase.from('locations').select('id').ilike('kode', lokasiKode).maybeSingle();
  if (!produk || !lokasi) {
    return NextResponse.json({ ok: false, error: 'Barang atau lokasi tidak ditemukan.' }, { status: 404 });
  }

  const [{ data: stock }, { data: threshold }] = await Promise.all([
    supabase.from('stock').select('qty, updated_at, updated_by').eq('product_id', produk.id).eq('location_id', lokasi.id).maybeSingle(),
    supabase.from('location_thresholds').select('stok_min, stok_maks').eq('product_id', produk.id).eq('location_id', lokasi.id).maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    ada: !!stock,
    qty: stock?.qty ?? 0,
    diperbarui: stock?.updated_at ?? null,
    stok_min: threshold?.stok_min ?? null,
    stok_maks: threshold?.stok_maks ?? null,
  });
}

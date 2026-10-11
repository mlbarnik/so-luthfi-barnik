import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { kandidatBarcode, bersihkanPencarian } from '@/lib/so/barcode';

/**
 * GET /api/produk?barcode=...   -> satu barang (toleran angka 0 di depan)
 * GET /api/produk?search=...    -> maks 8 hasil (nama atau barcode)
 *
 * Server-side lookup, BUKAN download seluruh Data Barang ke device.
 */
export async function GET(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  const supabase = sesi.supabase;
  const { searchParams } = new URL(req.url);
  const barcodeMentah = searchParams.get('barcode');
  const search = searchParams.get('search');

  if (barcodeMentah) {
    const kandidat = kandidatBarcode(barcodeMentah);
    if (kandidat.length === 0) {
      return NextResponse.json({ ok: false, error: 'Barcode kosong.' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('products').select('*').in('barcode', kandidat).eq('aktif', true).limit(5);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const cocok = data ?? [];
    if (cocok.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Barcode ${barcodeMentah.trim()} tidak ada di master barang.` },
        { status: 404 }
      );
    }
    // Utamakan yang persis sama; kalau tidak ada, dan ternyata cocok ke
    // lebih dari satu barang berbeda, jangan menebak -- minta pilih manual.
    const persis = cocok.find((p) => p.barcode === barcodeMentah.trim());
    if (persis) return NextResponse.json({ ok: true, data: persis });
    if (cocok.length === 1) return NextResponse.json({ ok: true, data: cocok[0] });
    return NextResponse.json(
      { ok: false, error: `Barcode ${barcodeMentah.trim()} cocok ke ${cocok.length} barang berbeda (${cocok.map((p) => p.nama).join(' / ')}). Pakai tombol Cari untuk memilih.` },
      { status: 409 }
    );
  }

  const q = search ? bersihkanPencarian(search) : '';
  if (q.length >= 2) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .or(`nama.ilike.%${q}%,barcode.ilike.%${q}%`)
      .limit(8);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: 'Isi barcode atau search (minimal 2 huruf).' }, { status: 400 });
}

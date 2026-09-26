import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';

/**
 * GET /api/produk?barcode=...   -> satu barang persis
 * GET /api/produk?search=...    -> maks 8 hasil, dicari via pg_trgm
 *
 * Server-side lookup, BUKAN download seluruh Data Barang ke device --
 * ini poin utama yang diperbaiki dari sistem lama (masalah 1A di PRD).
 */
export async function GET(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  const supabase = sesi.supabase;
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');
  const search = searchParams.get('search');

  if (barcode) {
    const { data, error } = await supabase
      .from('products').select('*').eq('barcode', barcode).eq('aktif', true).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'Barcode tidak ada di master barang.' }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  }

  if (search && search.trim().length >= 2) {
    const q = search.trim();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('aktif', true)
      .or(`nama.ilike.%${q}%,barcode.ilike.%${q}%`)
      .limit(8);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: 'Isi barcode atau search.' }, { status: 400 });
}

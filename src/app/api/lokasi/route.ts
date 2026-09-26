import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';

export async function GET(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  const supabase = sesi.supabase;
  const { searchParams } = new URL(req.url);
  const kode = searchParams.get('kode');
  const search = searchParams.get('search');

  if (kode) {
    const { data, error } = await supabase
      .from('locations').select('*').ilike('kode', kode).eq('aktif', true).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'Kode lokasi tidak ada di master lokasi.' }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  }

  if (search && search.trim().length >= 2) {
    const q = search.trim();
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('aktif', true)
      .or(`kode.ilike.%${q}%,zona.ilike.%${q}%,jenis.ilike.%${q}%,lantai.ilike.%${q}%`)
      .limit(8);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: 'Isi kode atau search.' }, { status: 400 });
}

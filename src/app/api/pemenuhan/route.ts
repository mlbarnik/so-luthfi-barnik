import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';

/** GET /api/pemenuhan?status=aktif|baru|disiapkan|eskalasi|display|semua */
export async function GET(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });

  const status = new URL(req.url).searchParams.get('status') ?? 'aktif';
  let q = sesi.supabase
    .from('fulfillment_requests')
    .select('*, products(nama, satuan, barcode), locations(kode, tipe, area)')
    .order('dibuat_at', { ascending: false })
    .limit(100);

  if (status === 'aktif') q = q.neq('status', 'display');
  else if (status !== 'semua') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

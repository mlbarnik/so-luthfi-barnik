import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { profilAPI } from '@/lib/so/guard';
import { sinkronSnapshotKeSheet } from '@/lib/so/sheets';

const BodySchema = z.object({ session_id: z.string().uuid().optional() });

export async function POST(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  if (!['admin', 'ic'].includes(sesi.profil.role)) {
    return NextResponse.json({ ok: false, error: 'Peran ini tidak boleh sinkron ke spreadsheet.' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  const sessionId = parsed.success ? parsed.data.session_id : undefined;

  const hasil = await sinkronSnapshotKeSheet(sessionId);
  if (!hasil.ok) {
    return NextResponse.json({ ok: false, error: hasil.error ?? 'Sinkron gagal.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, baris_ditulis: hasil.barisDitulis });
}

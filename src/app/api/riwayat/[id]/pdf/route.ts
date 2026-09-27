import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { ambilDataEkspor } from '@/lib/so/export-data';
import buatPdfLaporanSesi from '@/lib/so/laporan-pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });

  const data = await ambilDataEkspor(id);
  if (!data) return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan.' }, { status: 404 });

  const buffer = await buatPdfLaporanSesi();
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.kode}.pdf"`,
    },
  });
}

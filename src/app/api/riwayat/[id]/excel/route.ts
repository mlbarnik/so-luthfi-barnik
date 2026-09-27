import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { ambilDataEkspor } from '@/lib/so/export-data';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });

  const data = await ambilDataEkspor(id);
  if (!data) return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan.' }, { status: 404 });

  const summary = [
    ['Kode Sesi', data.kode],
    ['Mode', data.mode === 'harian' ? 'SO Harian' : 'Pendataan Awal'],
    ['PIC', data.pic_nama],
    ['Tanggal', new Date(data.dibuat).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })],
    ['Jumlah item', data.item_count],
    ['Total qty', data.total_qty],
  ];
  const headers = ['Barcode', 'Nama Barang', 'Lokasi', 'Satuan', 'Mode', 'Qty Sebelum', 'Qty Hasil', 'Selisih'];
  const renderRow = (values: unknown[], header = false) => `<tr>${values.map((value) => `<${header ? 'th' : 'td'}>${escapeHtml(value)}</${header ? 'th' : 'td'}>`).join('')}</tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #ccc;padding:4px}th{background:#efeee8}</style></head><body><h3>Ringkasan</h3><table>${summary.map((item) => renderRow(item)).join('')}</table><h3>Detail Item</h3><table>${renderRow(headers, true)}${data.items.map((item) => renderRow([item.barcode, item.nama, item.lokasi_kode, item.satuan, item.mode, item.qty_sebelum ?? '', item.qty, item.selisih ?? ''])).join('')}</table></body></html>`;
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${data.kode}.xls"`,
    },
  });
}

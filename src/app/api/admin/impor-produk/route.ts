import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { bacaExcel, type RingkasanImpor } from '@/lib/so/impor';

export const maxDuration = 60; // impor 6000+ baris bisa lebih dari 10 detik default Vercel

/**
 * POST /api/admin/impor-produk
 * Body: multipart/form-data, field "file" = file .xlsx
 * Kolom yang dibaca (header baris 1, huruf besar/kecil bebas):
 *   barcode, nama, satuan, kategori, harga
 * barcode & nama wajib. satuan default "PCS" kalau kosong.
 * Upsert berdasarkan barcode (barcode yang sudah ada -> datanya ditimpa).
 */
export async function POST(req: NextRequest) {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  if (sesi.profil.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Hanya admin yang boleh mengimpor master data.' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'File tidak ditemukan. Pilih file .xlsx dulu.' }, { status: 400 });
  }

  let baris;
  try {
    baris = await bacaExcel(await file.arrayBuffer());
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Gagal membaca file Excel.' }, { status: 400 });
  }
  if (baris.length === 0) {
    return NextResponse.json({ ok: false, error: 'File tidak berisi data (cuma header atau kosong).' }, { status: 400 });
  }

  const ringkasan: RingkasanImpor = { total: baris.length, sukses: 0, gagal: 0, detail: [] };
  const siapUpsert: { barcode: string; nama: string; satuan: string; kategori: string | null; harga: number | null }[] = [];
  const barcodeTerpakai = new Set<string>();

  baris.forEach((b, i) => {
    const noBaris = i + 2; // +2: baris 1 header, index mulai 0
    const barcode = String(b.barcode ?? '').trim();
    const nama = String(b.nama ?? '').trim();
    if (!barcode) { ringkasan.gagal++; ringkasan.detail.push({ baris: noBaris, ok: false, pesan: 'kolom barcode kosong' }); return; }
    if (!nama) { ringkasan.gagal++; ringkasan.detail.push({ baris: noBaris, ok: false, pesan: 'kolom nama kosong' }); return; }
    if (barcodeTerpakai.has(barcode)) {
      ringkasan.gagal++; ringkasan.detail.push({ baris: noBaris, ok: false, pesan: `barcode ${barcode} dobel di file ini (baris sebelumnya dipakai)` });
      return;
    }
    barcodeTerpakai.add(barcode);
    const harga = b.harga === undefined || b.harga === '' ? null : Number(b.harga);
    siapUpsert.push({
      barcode, nama,
      satuan: String(b.satuan ?? '').trim() || 'PCS',
      kategori: b.kategori ? String(b.kategori).trim() : null,
      harga: harga !== null && Number.isFinite(harga) ? harga : null,
    });
  });

  // upsert per batch 500 baris supaya tidak sekali kirim 6000+ row dalam satu request ke Supabase
  const UKURAN_BATCH = 500;
  for (let i = 0; i < siapUpsert.length; i += UKURAN_BATCH) {
    const potongan = siapUpsert.slice(i, i + UKURAN_BATCH);
    const { error } = await sesi.supabase.from('products').upsert(potongan, { onConflict: 'barcode' });
    if (error) {
      potongan.forEach((_, j) => {
        ringkasan.gagal++;
        ringkasan.detail.push({ baris: -1, ok: false, pesan: `batch gagal (baris sekitar ${i + j + 2}): ${error.message}` });
      });
    } else {
      ringkasan.sukses += potongan.length;
    }
  }

  return NextResponse.json({ ok: true, ringkasan });
}
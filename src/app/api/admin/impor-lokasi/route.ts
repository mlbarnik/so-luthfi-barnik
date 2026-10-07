import { NextResponse, type NextRequest } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { bacaExcel, type RingkasanImpor } from '@/lib/so/impor';

export const maxDuration = 60;

/**
 * Alias istilah -> nilai baku di database. Kunci map SUDAH dalam bentuk
 * "dinormalisasi" (huruf kecil, spasi/underscore/titik dibuang) supaya
 * "Gudang Utama", "gudang utama", "gudang_utama", "GudangUtama" semua
 * cocok ke satu nilai yang sama: 'gudang_utama'. Ini sengaja dibuat
 * longgar karena sumber data aslinya (Excel yang diisi manual oleh
 * toko) wajar bervariasi penulisannya.
 */
function normalisasiKunci(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_.-]+/g, '');
}

const ALIAS_TIPE: Record<string, string> = {
  rak: 'rak',
  pallet: 'pallet', palet: 'pallet',
  showcase: 'showcase',
  floor: 'floor', lantai: 'floor',
  freezer: 'freezer',
  buffer: 'buffer',
  displaygawang: 'display_gawang', gawang: 'display_gawang',
  wallhanger: 'wall_hanger', hanger: 'wall_hanger',
};
const ALIAS_AREA: Record<string, string> = {
  toko: 'toko',
  gudangutama: 'gudang_utama',
  gudanglt3: 'gudang_lt3', gudanglantai3: 'gudang_lt3',
};

const TIPE_LABEL = 'rak, pallet, display_gawang, wall_hanger, showcase, floor, freezer, buffer (atau: Rak, Pallet, DisplayGawang, WallHanger, Showcase, Floor, Freezer)';
const AREA_LABEL = 'toko, gudang_utama, gudang_lt3 (atau: Toko, Gudang Utama, Gudang Lt3)';

/**
 * POST /api/admin/impor-lokasi
 * Body: multipart/form-data, field "file" = file .xlsx
 * Kolom: kode, tipe, area, lantai, zona, jenis
 * Upsert berdasarkan kode.
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
  const siapUpsert: { kode: string; tipe: string; area: string; lantai: string | null; zona: string | null; jenis: string | null }[] = [];
  const kodeTerpakai = new Set<string>();

  baris.forEach((b, i) => {
    const noBaris = i + 2;
    const kode = String(b.kode ?? '').trim();
    const tipeMentah = String(b.tipe ?? '').trim();
    const areaMentah = String(b.area ?? '').trim();
    const tipe = ALIAS_TIPE[normalisasiKunci(tipeMentah)];
    const area = ALIAS_AREA[normalisasiKunci(areaMentah)];

    if (!kode) { ringkasan.gagal++; ringkasan.detail.push({ baris: noBaris, ok: false, pesan: 'kolom kode kosong' }); return; }
    if (!tipe) {
      ringkasan.gagal++;
      ringkasan.detail.push({ baris: noBaris, ok: false, pesan: `tipe '${tipeMentah}' tidak dikenal (pilih salah satu: ${TIPE_LABEL})` });
      return;
    }
    if (!area) {
      ringkasan.gagal++;
      ringkasan.detail.push({ baris: noBaris, ok: false, pesan: `area '${areaMentah}' tidak dikenal (pilih salah satu: ${AREA_LABEL})` });
      return;
    }
    if (kodeTerpakai.has(kode)) {
      ringkasan.gagal++; ringkasan.detail.push({ baris: noBaris, ok: false, pesan: `kode ${kode} dobel di file ini (baris sebelumnya dengan kode sama sudah dipakai)` });
      return;
    }
    kodeTerpakai.add(kode);
    siapUpsert.push({
      kode, tipe, area,
      lantai: b.lantai ? String(b.lantai).trim() : null,
      zona: b.zona ? String(b.zona).trim() : null,
      jenis: b.jenis ? String(b.jenis).trim() : null,
    });
  });

  const UKURAN_BATCH = 500;
  for (let i = 0; i < siapUpsert.length; i += UKURAN_BATCH) {
    const potongan = siapUpsert.slice(i, i + UKURAN_BATCH);
    const { error } = await sesi.supabase.from('locations').upsert(potongan, { onConflict: 'kode' });
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
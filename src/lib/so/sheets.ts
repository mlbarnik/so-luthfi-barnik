import 'server-only';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sinkron ke Google Sheets sebagai SNAPSHOT (menimpa satu rentang tetap),
 * BUKAN menambah baris tiap sesi SO. Ini keputusan sadar: 6.300+ SKU x
 * SO harian kalau ditumpuk sebagai log akan menabrak batas ~10 juta sel
 * Google Sheets dalam hitungan bulan -- persis masalah yang mau
 * ditinggalkan. Tim lain baca "posisi stok saat ini" dari tab ini;
 * histori lengkap tiap sesi tetap ada di Supabase (tabel so_sessions/so_items),
 * bukan di sheet.
 *
 * Env yang dibutuhkan:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (simpan dengan \n literal, lihat .env.example)
 *   GOOGLE_SHEET_ID
 *   GOOGLE_SHEET_TAB   (nama tab, default "Stok Saat Ini")
 */
function clientSheets() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum diisi.');
  }
  const auth = new google.auth.JWT({
    email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function sinkronSnapshotKeSheet(soSessionId?: string): Promise<{ ok: boolean; barisDitulis?: number; error?: string }> {
  const admin = createAdminClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || 'Stok Saat Ini';
  if (!sheetId) return { ok: false, error: 'GOOGLE_SHEET_ID belum diisi.' };

  interface BarisSnapshot {
    qty: number; updated_at: string;
    products: { barcode: string; nama: string; satuan: string } | null;
    locations: { kode: string; tipe: string; area: string } | null;
  }

  const { data: rows, error } = await admin
    .from('stock')
    .select('qty, updated_at, products(barcode, nama, satuan), locations(kode, tipe, area)')
    .order('updated_at', { ascending: false })
    .returns<BarisSnapshot[]>();

  if (error) {
    await admin.from('sheet_sync_log').insert({ so_session_id: soSessionId ?? null, status: 'gagal', pesan: error.message });
    return { ok: false, error: error.message };
  }

  const header = ['Barcode', 'Nama Barang', 'Satuan', 'Kode Lokasi', 'Tipe', 'Area', 'Qty', 'Diperbarui'];
  const body = (rows ?? []).map((r) => [
    r.products?.barcode ?? '', r.products?.nama ?? '', r.products?.satuan ?? '',
    r.locations?.kode ?? '', r.locations?.tipe ?? '', r.locations?.area ?? '',
    r.qty, r.updated_at,
  ]);

  try {
    const sheets = clientSheets();
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `${tab}!A1:Z200000` });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header, ...body] },
    });

    await admin.from('sheet_sync_log').insert({
      so_session_id: soSessionId ?? null, status: 'sukses', baris_ditulis: body.length,
    });
    if (soSessionId) {
      await admin.from('so_sessions').update({ sheet_synced_at: new Date().toISOString() }).eq('id', soSessionId);
    }
    return { ok: true, barisDitulis: body.length };
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'Gagal menulis ke Google Sheets.';
    await admin.from('sheet_sync_log').insert({ so_session_id: soSessionId ?? null, status: 'gagal', pesan });
    return { ok: false, error: pesan };
  }
}

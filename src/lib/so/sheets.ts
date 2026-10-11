import 'server-only';
import { google, type sheets_v4 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { bersihkanEnv } from '@/lib/supabase/env';

/**
 * Sinkron ke Google Sheets sebagai SNAPSHOT (menimpa satu tab), BUKAN
 * menambah baris tiap sesi SO -- supaya tidak menabrak batas sel Sheets.
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 *      GOOGLE_SHEET_ID, GOOGLE_SHEET_TAB (default "Stok Saat Ini")
 */

export function bersihkanPrivateKey(mentah: string | undefined): string | undefined {
  // dukung dua bentuk: satu baris dengan \n literal, atau baris asli hasil paste
  return bersihkanEnv(mentah)?.replace(/\\n/g, '\n');
}
export const idSheet = () => bersihkanEnv(process.env.GOOGLE_SHEET_ID);
export const namaTab = () => bersihkanEnv(process.env.GOOGLE_SHEET_TAB) || 'Stok Saat Ini';

export function clientSheets() {
  const email = bersihkanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = bersihkanPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!email || !privateKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum diisi.');
  }
  const auth = new google.auth.JWT({
    email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const pesanError = (err: unknown) => (err instanceof Error ? err.message : String(err));

function petunjukSupabase(pesan: string): string {
  return /invalid api key/i.test(pesan)
    ? ' -- SUPABASE_SECRET_KEY di server ini salah / tidak terbaca. Buka /api/admin/cek-koneksi (login sebagai admin) untuk diagnosa.'
    : '';
}
function petunjukGoogle(pesan: string): string {
  if (/permission|forbidden|403/i.test(pesan)) return ' -- Pastikan Google Sheet sudah di-Share ke email service account sebagai Editor.';
  if (/not found|404/i.test(pesan)) return ' -- Cek GOOGLE_SHEET_ID (salin ulang dari URL sheet).';
  if (/decoder|pem|asn1|private key/i.test(pesan)) return ' -- Format GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY rusak, salin ulang apa adanya dari file JSON.';
  if (/invalid_grant|jwt/i.test(pesan)) return ' -- Kunci service account tidak cocok / sudah dihapus di Google Cloud.';
  return '';
}

/** Google Sheets TIDAK otomatis menambah baris saat values.update menulis
 * melewati batas tab (tab baru cuma 1000 baris). Perbesar dulu kalau perlu. */
async function pastikanKapasitas(sheets: sheets_v4.Sheets, spreadsheetId: string, tab: string, perluBaris: number, perluKolom: number) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  if (!sheet?.properties) {
    throw new Error(`Tab "${tab}" tidak ada di spreadsheet. Cek GOOGLE_SHEET_TAB: huruf besar/kecil dan spasi harus persis sama dengan nama tab.`);
  }
  const baris = sheet.properties.gridProperties?.rowCount ?? 0;
  const kolom = sheet.properties.gridProperties?.columnCount ?? 0;
  if (baris >= perluBaris && kolom >= perluKolom) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: sheet.properties.sheetId,
            gridProperties: { rowCount: Math.max(baris, perluBaris + 100), columnCount: Math.max(kolom, perluKolom) },
          },
          fields: 'gridProperties.rowCount,gridProperties.columnCount',
        },
      }],
    },
  });
}

interface BarisSnapshot {
  qty: number; updated_at: string;
  products: { barcode: string; nama: string; satuan: string } | null;
  locations: { kode: string; tipe: string; area: string } | null;
}

const UKURAN_HALAMAN = 1000;   // batas bawaan Supabase (max_rows) per permintaan
const UKURAN_TULIS = 5000;     // baris per permintaan tulis ke Google Sheets

export async function sinkronSnapshotKeSheet(soSessionId?: string): Promise<{ ok: boolean; barisDitulis?: number; error?: string }> {
  const sheetId = idSheet();
  const tab = namaTab();
  if (!sheetId) return { ok: false, error: 'GOOGLE_SHEET_ID belum diisi.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { ok: false, error: `Supabase: ${pesanError(err)}` };
  }

  const catatLog = async (status: 'sukses' | 'gagal', pesan?: string, baris?: number) => {
    try {
      await admin.from('sheet_sync_log').insert({ so_session_id: soSessionId ?? null, status, pesan: pesan ?? null, baris_ditulis: baris ?? null });
    } catch { /* log gagal tidak boleh menutupi hasil utama */ }
  };

  // Ambil SELURUH stok per halaman -- tanpa ini Supabase diam-diam memotong
  // di 1000 baris dan snapshot di sheet jadi tidak lengkap.
  const semua: BarisSnapshot[] = [];
  for (let dari = 0; ; dari += UKURAN_HALAMAN) {
    const { data, error } = await admin
      .from('stock')
      .select('qty, updated_at, products(barcode, nama, satuan), locations(kode, tipe, area)')
      .order('product_id')
      .order('location_id')
      .range(dari, dari + UKURAN_HALAMAN - 1)
      .returns<BarisSnapshot[]>();
    if (error) {
      const pesan = `Supabase (membaca stok): ${error.message}${petunjukSupabase(error.message)}`;
      await catatLog('gagal', pesan);
      return { ok: false, error: pesan };
    }
    semua.push(...(data ?? []));
    if (!data || data.length < UKURAN_HALAMAN) break;
  }

  const header = ['Barcode', 'Nama Barang', 'Satuan', 'Kode Lokasi', 'Tipe', 'Area', 'Qty', 'Diperbarui'];
  const isi = semua.map((r) => [
    r.products?.barcode ?? '', r.products?.nama ?? '', r.products?.satuan ?? '',
    r.locations?.kode ?? '', r.locations?.tipe ?? '', r.locations?.area ?? '',
    r.qty, r.updated_at,
  ]);
  const semuaBaris = [header, ...isi];

  try {
    const sheets = clientSheets();
    const tabQ = `'${tab.replace(/'/g, "''")}'`;
    await pastikanKapasitas(sheets, sheetId, tab, semuaBaris.length, header.length);
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: tabQ });
    for (let i = 0; i < semuaBaris.length; i += UKURAN_TULIS) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabQ}!A${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: semuaBaris.slice(i, i + UKURAN_TULIS) },
      });
    }

    await catatLog('sukses', undefined, isi.length);
    if (soSessionId) {
      await admin.from('so_sessions').update({ sheet_synced_at: new Date().toISOString() }).eq('id', soSessionId);
    }
    return { ok: true, barisDitulis: isi.length };
  } catch (err) {
    const mentah = pesanError(err);
    const pesan = `Google Sheets: ${mentah}${petunjukGoogle(mentah)}`;
    await catatLog('gagal', pesan);
    return { ok: false, error: pesan };
  }
}
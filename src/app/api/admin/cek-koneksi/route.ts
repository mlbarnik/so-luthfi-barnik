import { NextResponse } from 'next/server';
import { profilAPI } from '@/lib/so/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { bersihkanEnv } from '@/lib/supabase/env';
import { clientSheets, idSheet, namaTab, bersihkanPrivateKey } from '@/lib/so/sheets';

/**
 * GET /api/admin/cek-koneksi  (khusus admin)
 * Mendiagnosa env var di server ini (Vercel atau lokal) TANPA pernah
 * menampilkan isi kunci -- hanya jenis/awalan, panjang, dan apakah ada
 * spasi/tanda kutip yang nyasar. Lalu benar-benar mengetes Supabase & Google.
 */
function infoKunci(mentah: string | undefined) {
  if (mentah === undefined || mentah === '') return { ada: false as const };
  const bersih = bersihkanEnv(mentah) ?? '';
  const jenis = bersih.startsWith('sb_secret_') ? 'sb_secret_ (secret key baru)'
    : bersih.startsWith('sb_publishable_') ? 'sb_publishable_ (publishable key)'
    : bersih.startsWith('eyJ') ? 'JWT lama (anon / service_role)'
    : 'TIDAK DIKENALI';
  let jwt: { role?: string; ref?: string } | null = null;
  if (bersih.startsWith('eyJ')) {
    try {
      jwt = JSON.parse(Buffer.from(bersih.split('.')[1], 'base64url').toString('utf8')) as { role?: string; ref?: string };
    } catch { jwt = null; }
  }
  return {
    ada: true as const,
    jenis,
    panjang: bersih.length,
    ada_spasi_atau_enter_di_ujung: mentah !== mentah.trim(),
    diapit_tanda_kutip: /^(["'])[\s\S]*\1$/.test(mentah.trim()),
    jwt_role: jwt?.role,
    jwt_project_ref: jwt?.ref,
  };
}

const pesanError = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function GET() {
  const sesi = await profilAPI();
  if (!sesi) return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
  if (sesi.profil.role !== 'admin') return NextResponse.json({ ok: false, error: 'Khusus admin.' }, { status: 403 });

  const petunjuk: string[] = [];
  const url = bersihkanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const refUrl = (() => { try { return url ? new URL(url).hostname.split('.')[0] : undefined; } catch { return undefined; } })();

  const publishable = infoKunci(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const secret = infoKunci(process.env.SUPABASE_SECRET_KEY);

  if (!secret.ada) petunjuk.push('SUPABASE_SECRET_KEY belum ada di server ini.');
  else {
    if (secret.jenis.startsWith('sb_publishable_')) petunjuk.push('Kolom SUPABASE_SECRET_KEY berisi PUBLISHABLE key. Seharusnya secret key (sb_secret_...) dari Settings > API Keys.');
    if (secret.jenis === 'TIDAK DIKENALI') petunjuk.push('Isi SUPABASE_SECRET_KEY tidak dikenali (bukan sb_secret_... dan bukan JWT). Salin ulang dari dashboard Supabase.');
    if (secret.jwt_role === 'anon') petunjuk.push('SUPABASE_SECRET_KEY berisi key anon, bukan service_role.');
    if (secret.jwt_project_ref && refUrl && secret.jwt_project_ref !== refUrl) petunjuk.push('SUPABASE_SECRET_KEY berasal dari proyek Supabase yang BERBEDA dengan NEXT_PUBLIC_SUPABASE_URL.');
    if (secret.ada_spasi_atau_enter_di_ujung || secret.diapit_tanda_kutip) petunjuk.push('Nilai SUPABASE_SECRET_KEY mengandung spasi/enter/tanda kutip nyasar (sudah otomatis dibersihkan oleh kode ini, tapi sebaiknya paste ulang yang bersih).');
  }

  // --- tes Supabase (secret key) ---
  let tesSupabase = 'OK';
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true });
    if (error) tesSupabase = `GAGAL: ${error.message}`;
  } catch (err) {
    tesSupabase = `GAGAL: ${pesanError(err)}`;
  }
  if (/invalid api key/i.test(tesSupabase)) petunjuk.push('Supabase menolak SUPABASE_SECRET_KEY ("Invalid API key"). Salin ulang secret key dari dashboard Supabase, paste ke Vercel (Production), lalu REDEPLOY.');

  // --- tes Google Sheets ---
  const pk = bersihkanPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const google = {
    email_ada: !!bersihkanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    private_key_ada: !!pk,
    private_key_diawali_BEGIN: pk?.startsWith('-----BEGIN PRIVATE KEY-----') ?? false,
    sheet_id_ada: !!idSheet(),
    nama_tab: namaTab(),
    tes: 'OK' as string,
  };
  try {
    const id = idSheet();
    if (!id) throw new Error('GOOGLE_SHEET_ID belum diisi.');
    const sheets = clientSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.title,sheets.properties.title' });
    const daftarTab = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    google.tes = daftarTab.includes(namaTab())
      ? `OK: spreadsheet "${meta.data.properties?.title}", tab "${namaTab()}" ditemukan`
      : `GAGAL: tab "${namaTab()}" tidak ada. Tab yang ada: ${daftarTab.join(', ')}`;
  } catch (err) {
    google.tes = `GAGAL: ${pesanError(err)}`;
  }

  return NextResponse.json({
    ok: true,
    ringkasan: tesSupabase === 'OK' && google.tes.startsWith('OK') ? 'SEMUA KONEKSI SEHAT' : 'ADA MASALAH, lihat petunjuk',
    petunjuk,
    supabase: { url_ada: !!url, project_ref_dari_url: refUrl, publishable_key: publishable, secret_key: secret, tes_baca_database_dengan_secret_key: tesSupabase },
    google,
    discord: {
      stok_display_ada: !!bersihkanEnv(process.env.DISCORD_WEBHOOK_STOK_DISPLAY),
      inventory_control_ada: !!bersihkanEnv(process.env.DISCORD_WEBHOOK_INVENTORY_CONTROL),
    },
  });
}

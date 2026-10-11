/**
 * Membaca env var dan MEMBERSIHKANNYA: spasi/enter di ujung dan tanda
 * kutip pembungkus dibuang. Ini penyebab klasik "jalan di localhost tapi
 * Invalid API key di Vercel": di .env.local nilai boleh ditulis dengan
 * tanda kutip, tapi kolom Environment Variables di Vercel menganggap
 * tanda kutip (dan spasi/enter hasil copy-paste) sebagai BAGIAN dari nilainya.
 */
export function bersihkanEnv(nilai: string | undefined): string | undefined {
  if (nilai === undefined) return undefined;
  const v = nilai.trim().replace(/^(["'])([\s\S]*)\1$/, '$2').trim();
  return v === '' ? undefined : v;
}

function wajib(nama: string): string {
  const v = bersihkanEnv(process.env[nama]);
  if (!v) throw new Error(`Env var ${nama} belum diisi. Cek .env.local / Environment Variables di Vercel (lihat .env.example).`);
  return v;
}

export const SUPABASE_URL = () => wajib('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_PUBLISHABLE_KEY = () => wajib('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const SUPABASE_SECRET_KEY = () => wajib('SUPABASE_SECRET_KEY');
export const PIN_HMAC_SECRET = () => wajib('PIN_HMAC_SECRET');
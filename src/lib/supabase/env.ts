function wajib(nama: string): string {
  const v = process.env[nama];
  if (!v) throw new Error(`Env var ${nama} belum diisi. Cek .env.local (lihat .env.example).`);
  return v;
}

export const SUPABASE_URL = () => wajib('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_PUBLISHABLE_KEY = () => wajib('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const SUPABASE_SECRET_KEY = () => wajib('SUPABASE_SECRET_KEY');
export const PIN_HMAC_SECRET = () => wajib('PIN_HMAC_SECRET');

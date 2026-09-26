import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Peran } from '@/types/database';

/**
 * Ini penjaga akses yang SEBENARNYA (bukan proxy.ts). Selalu pakai
 * getUser() -- tervalidasi ke server Supabase Auth, beda dengan
 * getSession() yang cuma baca cookie tanpa verifikasi ulang.
 *
 * Ada DUA varian dengan sengaja:
 *  - wajibLogin()/wajibPeran()  : untuk Server Component halaman.
 *    Next.js redirect() cuma valid dipanggil dari situ (dia melempar
 *    sinyal khusus yang ditangkap pipeline render React).
 *  - profilAPI()                : untuk Route Handler (route.ts).
 *    redirect() TIDAK berfungsi di Route Handler biasa -- kalau dipakai
 *    di sana hasilnya malah error 500, bukan redirect. Route Handler
 *    harus mengembalikan NextResponse.json(..., {status:401}) sendiri.
 */
export async function ambilProfilSaya(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; profil: Profile } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .eq('aktif', true)
    .single<Profile>();

  if (!profil) return null;
  return { supabase, profil };
}

/** Server Component halaman: redirect ke /login kalau belum masuk. */
export async function wajibLogin(): Promise<Profile> {
  const hasil = await ambilProfilSaya();
  if (!hasil) redirect('/login');
  return hasil.profil;
}

/** Server Component halaman yang perlu peran tertentu. */
export async function wajibPeran(peranBoleh: Peran[]): Promise<Profile> {
  const profil = await wajibLogin();
  if (!peranBoleh.includes(profil.role)) redirect('/hitung');
  return profil;
}

/** Route Handler: kembalikan profil + client, atau null kalau belum login.
 * JANGAN pakai redirect() di sini -- lihat catatan di atas. */
export async function profilAPI() {
  return ambilProfilSaya();
}

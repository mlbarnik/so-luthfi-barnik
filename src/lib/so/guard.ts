import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Peran } from '@/types/database';

/**
 * PENTING UNTUK PERFORMA: dibungkus React cache(). Kalau beberapa Server
 * Component di SATU kali render halaman yang sama (mis. layout.tsx DAN
 * page.tsx di dalamnya) sama-sama memanggil fungsi ini, React akan
 * memakai hasil panggilan pertama untuk yang berikutnya -- bukan
 * menghubungi Supabase ulang dari nol tiap kali. Sebelumnya tiap
 * halaman (Dashboard, Riwayat, Akun) memeriksa sesi sendiri-sendiri DI
 * ATAS pengecekan yang layout.tsx sudah lakukan -- ini salah satu
 * penyebab utama "pindah menu lambat".
 *
 * Catatan: cache() di sini hanya berlaku dalam SATU request (satu kali
 * pindah halaman), tidak dibagi antar pengguna atau antar request --
 * aman, bukan kebocoran data antar sesi.
 */
export const ambilProfilSaya = cache(async (): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; profil: Profile } | null> => {
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
});

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
 * JANGAN pakai redirect() di sini -- redirect() cuma valid di Server
 * Component/Server Action, bukan di route.ts biasa. */
export async function profilAPI() {
  return ambilProfilSaya();
}
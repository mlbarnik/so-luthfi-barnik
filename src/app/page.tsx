import { redirect } from 'next/navigation';
import { ambilProfilSaya } from '@/lib/so/guard';
import { HAK_AKSES } from '@/types/database';

export default async function Beranda() {
  const sesi = await ambilProfilSaya();
  if (!sesi) redirect('/login');
  redirect(HAK_AKSES[sesi.profil.role].dashboard ? '/dashboard' : '/hitung');
}

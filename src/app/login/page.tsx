import { redirect } from 'next/navigation';
import { ambilProfilSaya } from '@/lib/so/guard';
import { LoginForm } from './login-form';

export default async function HalamanLogin() {
  const sesi = await ambilProfilSaya();
  if (sesi) redirect('/');
  return <LoginForm />;
}

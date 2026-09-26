import { wajibLogin } from '@/lib/so/guard';
import { AppShell } from '@/components/so/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await wajibLogin();
  return <AppShell profil={profil}>{children}</AppShell>;
}

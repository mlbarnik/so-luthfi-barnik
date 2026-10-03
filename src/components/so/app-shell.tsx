'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ScanLine, ClipboardList, History, LayoutDashboard, PackageSearch, UserRound,
} from 'lucide-react';
import type { Profile } from '@/types/database';
import { HAK_AKSES } from '@/types/database';
import { cn } from '@/lib/utils';

const LABEL_PERAN: Record<string, string> = {
  admin: 'Admin', pic: 'PIC', ic: 'Inventory Control',
  kepala_toko: 'Kepala Toko', spv: 'Supervisor', owner: 'Owner', gm: 'General Manajer',
};

function tabsUntuk(profil: Profile) {
  const hak = HAK_AKSES[profil.role];
  const tabs: { href: string; label: string; icon: React.ElementType }[] = [];
  if (hak.hitung) {
    tabs.push({ href: '/hitung', label: 'Hitung', icon: ScanLine });
    tabs.push({ href: '/draft', label: 'Draft', icon: ClipboardList });
  }
  if (hak.pemenuhanLihat) tabs.push({ href: '/pemenuhan', label: 'Pemenuhan', icon: PackageSearch });
  if (hak.dashboard) tabs.push({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
  tabs.push({ href: '/riwayat', label: 'Riwayat', icon: History });
  tabs.push({ href: '/akun', label: 'Akun', icon: UserRound });
  return tabs;
}

export function AppShell({ profil, children }: { profil: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = tabsUntuk(profil);

  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-neutral-950 md:flex-row">
      <aside className="hidden shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 md:sticky md:top-0 md:flex md:h-dvh md:w-[72px] lg:w-60">
        <div className="flex items-center gap-3 px-4 py-5 md:justify-center lg:justify-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
            LB
          </div>
          <div className="hidden min-w-0 lg:block">
            <b className="block truncate text-[15px] font-semibold">Stock Opname</b>
            <span className="block text-xs text-neutral-500">Luthfi Barnik · Duri</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2.5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const aktif = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium md:justify-center lg:justify-start',
                  aktif
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-4 dark:border-neutral-800 md:justify-center lg:justify-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            {profil.inisial}
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-semibold">{profil.nama}</div>
            <div className="text-xs text-neutral-500">{LABEL_PERAN[profil.role]}</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] dark:border-neutral-800 md:hidden">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">Stock Opname</b>
            <span className="block text-xs text-neutral-500">Luthfi Barnik · Duri</span>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            {profil.inisial}
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-4 md:max-w-3xl md:px-8 md:pt-8 lg:max-w-6xl">
          {children}
        </main>

        <nav
          className="sticky bottom-0 grid border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-950 md:hidden"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}
        >
          {tabs.map(({ href, label, icon: Icon }) => {
            const aktif = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 pt-2.5 text-[10.5px] font-medium',
                  aktif ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-400'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.7} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export { LABEL_PERAN };
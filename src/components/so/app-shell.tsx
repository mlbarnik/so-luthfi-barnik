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
  kepala_toko: 'Kepala Toko', spv: 'Supervisor', owner: 'Owner',
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
  if (!hak.dashboard) tabs.push({ href: '/riwayat', label: 'Riwayat', icon: History });
  tabs.push({ href: '/akun', label: 'Akun', icon: UserRound });
  return tabs;
}

export function AppShell({ profil, children }: { profil: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = tabsUntuk(profil);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white dark:bg-neutral-950 md:my-6 md:min-h-[calc(100dvh-3rem)] md:rounded-2xl md:border md:border-neutral-200 md:shadow-xl md:dark:border-neutral-800">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] dark:border-neutral-800">
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold">Stock Opname</b>
          <span className="block text-xs text-neutral-500">Luthfi Barnik · Duri</span>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
          {profil.inisial}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-8 pt-4">{children}</main>

      <nav
        className="grid border-t border-neutral-200 pb-[env(safe-area-inset-bottom)] dark:border-neutral-800"
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
  );
}

export { LABEL_PERAN };

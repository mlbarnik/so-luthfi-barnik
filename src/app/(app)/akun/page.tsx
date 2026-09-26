import { wajibLogin } from '@/lib/so/guard';
import { HAK_AKSES } from '@/types/database';
import { TombolKeluar } from '@/components/so/tombol-keluar';
import { LABEL_PERAN } from '@/components/so/app-shell';

export default async function HalamanAkun() {
  const profil = await wajibLogin();
  const hak = HAK_AKSES[profil.role];

  return (
    <div>
      <h2 className="text-lg font-semibold">Akun</h2>
      <p className="mb-4 text-sm text-neutral-500">Sesi & hak akses.</p>

      <div className="mb-3 flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-neutral-900 text-base font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
          {profil.inisial}
        </div>
        <div>
          <div className="font-semibold">{profil.nama}</div>
          <div className="text-xs text-neutral-500">{LABEL_PERAN[profil.role]}</div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-2 text-xs font-semibold text-neutral-500">Hak akses peran ini</div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hak.hitung ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>
            {hak.hitung ? 'Boleh mendata' : 'Tidak mendata'}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hak.pemenuhanAksi ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : hak.pemenuhanLihat ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>
            {hak.pemenuhanAksi ? 'Ubah status pemenuhan' : hak.pemenuhanLihat ? 'Lihat pemenuhan' : 'Tanpa akses pemenuhan'}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hak.dashboard ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>
            {hak.dashboard ? 'Lihat dashboard' : 'Tanpa dashboard'}
          </span>
        </div>
      </div>

      <TombolKeluar />
    </div>
  );
}

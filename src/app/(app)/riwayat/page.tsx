import { createClient } from '@/lib/supabase/server';
import { wajibLogin } from '@/lib/so/guard';
import { TombolSinkron } from '@/components/so/tombol-sinkron';

interface Baris {
  id: string; kode: string; mode: string; item_count: number; total_qty: number;
  sheet_synced_at: string | null; created_at: string; profiles: { nama: string } | null;
}

export default async function HalamanRiwayat() {
  const profil = await wajibLogin();
  const supabase = await createClient();

  let q = supabase
    .from('so_sessions')
    .select('id, kode, mode, item_count, total_qty, sheet_synced_at, created_at, profiles(nama)')
    .order('created_at', { ascending: false })
    .limit(30);
  if (profil.role === 'pic') q = q.eq('pic_id', profil.id);

  const { data } = await q.returns<Baris[]>();
  const sesi = data ?? [];
  const belumSinkron = sesi.filter((s) => !s.sheet_synced_at).length;

  return (
    <div>
      <h2 className="text-lg font-semibold">Riwayat</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Sesi SO yang sudah tersimpan di database.{belumSinkron > 0 && <> <b>{belumSinkron}</b> belum masuk spreadsheet.</>}
      </p>

      {sesi.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">Belum ada sesi SO.</p>}

      <div className="space-y-3">
        {sesi.map((s) => (
          <div key={s.id} className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.profiles?.nama ?? '-'}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {s.mode === 'harian' ? 'SO harian' : 'Pendataan'}
              </span>
              <span className="ml-auto font-mono text-xs text-neutral-500">{s.kode}</span>
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              {new Date(s.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
              {s.item_count} item · {s.total_qty} unit
            </p>
            <TombolSinkron sessionId={s.id} sudahSinkron={!!s.sheet_synced_at} />
          </div>
        ))}
      </div>
    </div>
  );
}

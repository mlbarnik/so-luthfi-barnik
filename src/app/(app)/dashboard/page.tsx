import { createClient } from '@/lib/supabase/server';
import { wajibPeran } from '@/lib/so/guard';
import { TombolSinkron } from '@/components/so/tombol-sinkron';

export default async function HalamanDashboard() {
  await wajibPeran(['admin', 'ic', 'spv', 'owner', 'gm']);
  const supabase = await createClient();

  const [
    { count: totalLokasi },
    { count: totalProduk },
    { count: reqAktif },
    { count: eskalasi },
    { data: sesiBelum },
  ] = await Promise.all([
    supabase.from('locations').select('*', { count: 'exact', head: true }).eq('aktif', true),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('aktif', true),
    supabase.from('fulfillment_requests').select('*', { count: 'exact', head: true }).neq('status', 'display'),
    supabase.from('fulfillment_requests').select('*', { count: 'exact', head: true }).eq('status', 'eskalasi'),
    supabase.from('so_sessions').select('id').is('sheet_synced_at', null).limit(1),
  ]);

  // Ambang batas & stok digabung manual di JS: PostgREST tidak bisa
  // memfilter "qty <= kolom di tabel lain" lewat join biasa.
  interface BarisStok { qty: number; product_id: string; location_id: string; locations: { kode: string } | null }
  interface BarisThreshold { product_id: string; location_id: string; stok_min: number; stok_maks: number }
  interface BarisTipis { kode: string; qty: number; maks: number; min: number; pct: number; rendah: boolean }

  const { data: semuaStok } = await supabase
    .from('stock')
    .select('qty, product_id, location_id, locations(kode)')
    .limit(2000)
    .returns<BarisStok[]>();
  const { data: semuaThreshold } = await supabase
    .from('location_thresholds')
    .select('product_id, location_id, stok_min, stok_maks')
    .returns<BarisThreshold[]>();

  const thMap = new Map<string, BarisThreshold>(
    (semuaThreshold ?? []).map((t: BarisThreshold) => [`${t.product_id}:${t.location_id}`, t]),
  );
  const tipis = (semuaStok ?? [])
    .map((s: BarisStok): BarisTipis | null => {
      const th = thMap.get(`${s.product_id}:${s.location_id}`);
      if (!th) return null;
      const pct = Math.min(100, Math.round((s.qty / Math.max(th.stok_maks, 1)) * 100));
      return { kode: s.locations?.kode ?? '-', qty: s.qty, maks: th.stok_maks, min: th.stok_min, pct, rendah: s.qty <= th.stok_min };
    })
    .filter((x: BarisTipis | null): x is BarisTipis => x !== null)
    .sort((a: BarisTipis, b: BarisTipis) => a.pct - b.pct)
    .slice(0, 6);
  const jumlahDibawahMin = (semuaStok ?? []).filter((s) => {
    const th = thMap.get(`${s.product_id}:${s.location_id}`);
    return th && s.qty <= th.stok_min;
  }).length;

  const belumSinkronAda = (sesiBelum?.length ?? 0) > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="mb-4 text-sm text-neutral-500">Cakupan pendataan, kesehatan display, dan sinkronisasi.</p>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <Stat label="lokasi aktif" value={totalLokasi ?? 0} gelap />
        <Stat label="SKU aktif" value={totalProduk ?? 0} />
        <Stat label="permintaan pemenuhan aktif" value={reqAktif ?? 0} />
        <Stat label="menunggu Gudang Utama" value={eskalasi ?? 0} merah={!!eskalasi} />
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-2 text-xs font-semibold text-neutral-500">Lokasi paling tipis</div>
        {tipis.length === 0 && <p className="text-sm text-neutral-400">Belum ada data stok.</p>}
        {tipis.map((t) => (
          <div key={t.kode} className="flex items-center gap-2.5 border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-800">
            <span className="w-16 shrink-0 font-mono text-xs">{t.kode}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className={`h-full ${t.rendah ? 'bg-red-500' : t.pct < 40 ? 'bg-amber-500' : 'bg-neutral-900 dark:bg-neutral-100'}`} style={{ width: `${Math.max(2, t.pct)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-neutral-500">{t.qty}/{t.maks}</span>
          </div>
        ))}
        <p className="mt-2 text-[11px] text-neutral-400">{jumlahDibawahMin} lokasi total di bawah stok minimum. Merah = sudah di bawah minimum.</p>
      </div>

      <div className="rounded-xl bg-neutral-900 p-4 text-white dark:bg-neutral-800">
        <h3 className="text-base font-semibold">Kirim ke spreadsheet</h3>
        <p className="mb-3 text-sm text-neutral-300">
          {belumSinkronAda ? 'Ada sesi SO yang belum masuk Google Sheets.' : 'Semua sesi sudah masuk Google Sheets.'}
        </p>
        <TombolSinkron />
      </div>
    </div>
  );
}

function Stat({ label, value, gelap, merah }: { label: string; value: number; gelap?: boolean; merah?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${gelap ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <div className={`text-2xl font-semibold leading-none ${merah ? 'text-red-500' : ''}`}>{value}</div>
      <div className={`mt-1 text-[11px] ${gelap ? 'text-neutral-300' : 'text-neutral-500'}`}>{label}</div>
    </div>
  );
}

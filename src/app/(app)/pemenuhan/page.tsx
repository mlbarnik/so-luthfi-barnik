'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { PackageSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FulfillmentRequest, Product, Location } from '@/types/database';

type Baris = FulfillmentRequest & { products: Pick<Product, 'nama' | 'satuan' | 'barcode'>; locations: Pick<Location, 'kode' | 'tipe' | 'area'> };

const FILTERS = ['aktif', 'baru', 'disiapkan', 'eskalasi', 'display', 'semua'] as const;
const LABEL_FILTER: Record<(typeof FILTERS)[number], string> = {
  aktif: 'Aktif', baru: 'Baru', disiapkan: 'Disiapkan', eskalasi: 'Ke Gudang Utama', display: 'Selesai', semua: 'Semua',
};
const LABEL_STATUS: Record<string, string> = {
  baru: 'Menunggu tim Lt.3', disiapkan: 'Disiapkan malam ini', display: 'Sudah didisplay', eskalasi: 'Diminta ke Gudang Utama',
};

export default function HalamanPemenuhan() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('aktif');
  const [data, setData] = useState<Baris[]>([]);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    const res = await fetch(`/api/pemenuhan?status=${filter}`);
    const json = await res.json();
    setData(json.ok ? json.data : []);
    setMemuat(false);
  }, [filter]);

  // Mengambil data dari server saat mount / filter berubah -- sinkronisasi
  // dengan sistem eksternal, bukan derived state dari state React lain.
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { muat(); }, [muat]);

  async function ubah(id: string, status: 'disiapkan' | 'eskalasi' | 'display') {
    const catatan =
      status === 'eskalasi' ? 'Lantai 3 kosong — diteruskan ke Gudang Utama'
      : status === 'display' ? 'Didisplay'
      : 'Disiapkan tim Lt.3';
    const res = await fetch(`/api/pemenuhan/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, catatan }),
    });
    const json = await res.json();
    if (!json.ok) return toast.error(json.error ?? 'Gagal mengubah status.');
    toast.success('Status diperbarui', { description: 'Notifikasi dikirim ke Discord' });
    muat();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Pemenuhan display</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Antrean dari notifikasi stok minimum. Tim Gudang Lt.3 menyiapkan malam hari, kepala toko menandai setelah display diisi.
      </p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
          >
            {LABEL_FILTER[f]}
          </button>
        ))}
      </div>

      {memuat && <p className="py-10 text-center text-sm text-neutral-400">Memuat…</p>}
      {!memuat && data.length === 0 && (
        <div className="py-16 text-center text-neutral-400">
          <PackageSearch className="mx-auto mb-3 h-8 w-8" />
          <b className="block text-neutral-700 dark:text-neutral-200">Tidak ada di filter ini</b>
          Coba filter lain.
        </div>
      )}

      <div className="space-y-3">
        {data.map((r) => (
          <div key={r.id} className={`rounded-xl border p-3.5 ${r.status === 'baru' && r.sisa === 0 ? 'border-red-400' : 'border-neutral-200 dark:border-neutral-800'}`}>
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-tight">{r.products.nama}</div>
                <div className="font-mono text-xs text-neutral-500">{r.kode} · {r.locations.kode} ({r.locations.tipe})</div>
              </div>
              <Badge variant={r.status === 'display' ? 'baru' : r.status === 'eskalasi' ? 'warn' : r.status === 'disiapkan' ? 'add' : 'over'}>
                {LABEL_STATUS[r.status]}
              </Badge>
            </div>
            <div className="mb-2 flex gap-4 text-xs text-neutral-500">
              <span>sisa <b className={r.sisa === 0 ? 'text-red-600' : ''}>{r.sisa}</b></span>
              <span>minimum {r.stok_min}</span>
              <span>isi ±{r.target_isi} {r.products.satuan}</span>
            </div>
            {r.catatan && <p className="mb-2 text-xs text-neutral-500">{r.catatan}</p>}
            <div className="flex gap-2">
              {r.status === 'baru' && (
                <>
                  <Button size="sm" onClick={() => ubah(r.id, 'disiapkan')}>Tandai disiapkan</Button>
                  <Button size="sm" variant="outline" onClick={() => ubah(r.id, 'eskalasi')}>Lt.3 kosong</Button>
                </>
              )}
              {r.status === 'disiapkan' && <Button size="sm" onClick={() => ubah(r.id, 'display')}>Sudah didisplay</Button>}
              {r.status === 'eskalasi' && <Button size="sm" onClick={() => ubah(r.id, 'disiapkan')}>Barang dari Gudang Utama datang</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

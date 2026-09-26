'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useDraft, ambilIdemKey, resetIdemKey } from '@/lib/so/draft-store';
import type { SubmitResult } from '@/types/database';

export default function HalamanDraft() {
  const router = useRouter();
  const { items, hapus, kosongkan } = useDraft();
  const [mengirim, setMengirim] = useState(false);

  const totalQty = items.reduce((a, b) => a + b.qty, 0);
  const lokasiSet = new Set(items.map((d) => d.lokasi_kode));
  const akanReq = items.filter((d) => d.di_bawah_min).length;

  async function kirim() {
    if (items.length === 0 || mengirim) return;
    setMengirim(true);
    const idem = ambilIdemKey();
    const modeSO = items[0]?.so_mode ?? 'awal';
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idem,
          mode: modeSO,
          items: items.map((d) => ({
            client_item_id: d.client_item_id, barcode: d.barcode,
            lokasi_kode: d.lokasi_kode, qty: d.qty, mode: d.mode,
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error ?? 'Server tidak bisa menyimpan draft ini.', { description: 'Draft di perangkat tetap tersimpan, coba lagi.' });
        return;
      }
      const hasil = json as SubmitResult & { ok: true };
      kosongkan();
      resetIdemKey();
      toast.success(`${hasil.item_count} item tersimpan · ${hasil.total_qty} unit`, { description: hasil.kode });
      if (hasil.new_requests.length) {
        toast.info(`${hasil.new_requests.length} permintaan pemenuhan dikirim ke Discord`, { description: '#stok-display' });
      }
      router.push('/riwayat');
    } catch {
      toast.error('Koneksi terputus. Draft tetap tersimpan dan belum dikirim.');
    } finally {
      setMengirim(false);
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Draft</h2>
        <p className="mb-4 text-sm text-neutral-500">Item yang sudah didata tapi belum dikirim.</p>
        <div className="py-16 text-center text-neutral-400">
          <PackageOpen className="mx-auto mb-3 h-8 w-8" />
          <b className="block text-neutral-700 dark:text-neutral-200">Draft masih kosong</b>
          Mulai dari tab Hitung.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Draft</h2>
      <p className="mb-3 text-sm text-neutral-500">{items.length} item · {totalQty} unit · {lokasiSet.size} lokasi</p>

      {akanReq > 0 && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {akanReq} lokasi di bawah minimum. Saat dikirim, sistem membuat permintaan pemenuhan &amp; notifikasi Discord.
        </p>
      )}

      <Card className="divide-y divide-neutral-200 p-0 dark:divide-neutral-800">
        {items.map((d) => (
          <div key={d.client_item_id} className="flex gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{d.nama}</div>
              <div className="font-mono text-xs text-neutral-500">{d.barcode} · {d.lokasi_kode}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant={d.mode === 'BARU' ? 'baru' : d.mode === 'ADD' ? 'add' : 'over'}>{d.mode}</Badge>
                {d.so_mode === 'harian' && d.qty_sebelum != null && (
                  <Badge variant={d.qty - d.qty_sebelum < 0 ? 'warn' : 'neutral'}>
                    selisih {d.qty - d.qty_sebelum > 0 ? '+' : ''}{d.qty - d.qty_sebelum}
                  </Badge>
                )}
                {d.di_bawah_min && <Badge variant="warn">perlu diisi</Badge>}
              </div>
              <button onClick={() => hapus(d.client_item_id)} className="mt-1.5 text-xs font-semibold text-red-600">Hapus</button>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold leading-none">{d.qty}</div>
              <div className="mt-1 text-[10.5px] font-semibold text-neutral-400">{d.satuan}</div>
            </div>
          </div>
        ))}
      </Card>

      <Button className="mt-4 w-full" size="lg" onClick={kirim} disabled={mengirim}>
        <Send className="h-4 w-4" />
        {mengirim ? 'Mengirim…' : `Kirim ${items.length} item`}
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={kosongkan} disabled={mengirim}>
        Kosongkan draft
      </Button>
    </div>
  );
}
